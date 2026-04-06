/**
 * Edge Function: generate-document
 * Downloads a DOCX template, replaces {{variables}} with real data,
 * saves the filled DOCX to storage, and updates generated_documents.
 * 
 * UNIFIED PIPELINE: Uses flattenSnapshot + official domain resolvers
 * as the SINGLE SOURCE OF TRUTH — same base as template-preview.
 * Document-only vars (contrato, assinatura) are added as isolated enrichment.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeVariableFormat, defragmentXml } from "../_shared/normalizeVariableFormat.ts";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";
import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";
import {
  withRetry,
  fetchWithTimeout,
  isCircuitOpen,
  recordFailure,
  resetCircuit,
  sanitizeError,
  updateHealthCache,
  type CircuitBreakerState,
} from "../_shared/error-utils.ts";

// In-memory circuit breaker state (resets per cold start)
let circuitState: CircuitBreakerState = { failures: 0, last_failure_at: null, open_until: null };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ────────────────────────────────────────

/** Replace {{variable}} placeholders in text */
function replaceVars(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const k = key.trim();
    return ctx[k] ?? ctx[k.replace(/\./g, "_")] ?? "";
  });
}

/**
 * Evaluate inline IF()/SWITCH() formulas in text AFTER variable substitution.
 * Handles string comparisons like: IF("Integrada"="Integrada"; "texto A"; "texto B")
 * These appear when the template uses IF([pos_incluir_string_box]="Integrada"; "A"; "B")
 * and [pos_incluir_string_box] was already substituted with its value.
 */
function evaluateInlineFormulas(text: string): string {
  // Use balanced parentheses matching to support nested IF()
  const MAX_PASSES = 10;
  let result = text;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const ifIdx = findIFStart(result);
    if (ifIdx === -1) break;
    const openParen = result.indexOf("(", ifIdx);
    if (openParen === -1) break;
    const closeParen = findMatchingParen(result, openParen);
    if (closeParen === -1) break;
    const fullMatch = result.substring(ifIdx, closeParen + 1);
    const argsStr = result.substring(openParen + 1, closeParen);
    const evaluated = evaluateSingleIF(argsStr);
    result = result.substring(0, ifIdx) + evaluated + result.substring(closeParen + 1);
  }
  return result;
}

/** Find next IF( ignoring case */
function findIFStart(text: string): number {
  const lower = text.toLowerCase();
  let idx = 0;
  while (idx < text.length) {
    const pos = lower.indexOf("if", idx);
    if (pos === -1) return -1;
    // Check it's IF followed by optional whitespace then (
    let j = pos + 2;
    while (j < text.length && text[j] === " ") j++;
    if (j < text.length && text[j] === "(") return pos;
    idx = pos + 1;
  }
  return -1;
}

/** Find matching closing paren, respecting nesting and quotes */
function findMatchingParen(text: string, openPos: number): number {
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";
  for (let i = openPos; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Evaluate a single IF's arguments (may contain already-resolved nested IFs) */
function evaluateSingleIF(argsStr: string): string {
  // Recursively evaluate any nested IF() inside args first
  const resolved = evaluateInlineFormulas(argsStr);
  const parts = splitFormulaParts(resolved);
  if (parts.length < 3) return argsStr;

  const condition = parts[0].trim();
  const thenVal = unquote(parts[1].trim());
  const elseVal = unquote(parts[2].trim());

  const neqMatch = condition.match(/^(.+?)<>(.+)$/);
  const eqMatch = condition.match(/^(.+?)=(.+)$/);

  if (neqMatch) {
    const left = unquote(neqMatch[1].trim());
    const right = unquote(neqMatch[2].trim());
    return left !== right ? thenVal : elseVal;
  }
  if (eqMatch) {
    const left = unquote(eqMatch[1].trim());
    const right = unquote(eqMatch[2].trim());
    return left === right ? thenVal : elseVal;
  }

  const condClean = unquote(condition);
  if (condClean && condClean !== "0" && condClean.toLowerCase() !== "false") {
    return thenVal;
  }
  return elseVal;
}

/** Split formula arguments respecting quoted strings */
function splitFormulaParts(s: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      }
      current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === ";" || ch === ",") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Remove surrounding quotes from a string */
function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  // Also handle XML-encoded quotes
  if (s.startsWith("&quot;") && s.endsWith("&quot;")) {
    return s.slice(6, -6);
  }
  return s;
}

/** Format BRL currency */
function formatBRL(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Format date extenso in pt-BR with Brasília timezone */
function formatDateExtenso(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Build payment description from payment_composition JSONB */
function buildPaymentDescription(composition: any[], valorTotal: number | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!composition || !Array.isArray(composition) || composition.length === 0) return result;

  const parts: string[] = [];
  let entradaTotal = 0;
  let financiadoTotal = 0;

  for (const item of composition) {
    const entrada = Number(item.entrada) || 0;
    const parcelas = Number(item.parcelas) || 0;
    const valorBase = Number(item.valor_base) || 0;
    const banco = item.observacoes || item.banco || "";

    if (entrada > 0) {
      entradaTotal += entrada;
      parts.push(`${formatBRL(entrada)} entrada`);
    }
    if (parcelas > 0 && valorBase > 0) {
      financiadoTotal += parcelas * valorBase;
      parts.push(`${parcelas}x ${formatBRL(valorBase)}`);
    }
    if (banco) {
      result["pagamento_banco_nome"] = banco;
      result["pagamento.banco_nome"] = banco;
    }
  }

  const formaDescrita = parts.join(" + ") || "—";
  result["pagamento_forma_descrita"] = formaDescrita;
  result["pagamento.forma_descrita"] = formaDescrita;

  result["pagamento_entrada_valor"] = entradaTotal > 0 ? formatBRL(entradaTotal) : "—";
  result["pagamento.entrada_valor"] = result["pagamento_entrada_valor"];

  if (valorTotal && valorTotal > 0 && entradaTotal > 0) {
    const pct = Math.round((entradaTotal / valorTotal) * 100);
    result["pagamento_entrada_percentual"] = `${pct}%`;
    result["pagamento.entrada_percentual"] = `${pct}%`;
  } else {
    result["pagamento_entrada_percentual"] = "—";
    result["pagamento.entrada_percentual"] = "—";
  }

  result["pagamento_total_financiado"] = financiadoTotal > 0 ? formatBRL(financiadoTotal) : "—";
  result["pagamento.total_financiado"] = result["pagamento_total_financiado"];

  const firstItem = composition[0];
  if (firstItem) {
    const parcelas = Number(firstItem.parcelas) || 0;
    const valorBase = Number(firstItem.valor_base) || 0;
    result["pagamento_parcelas_quantidade"] = parcelas > 0 ? String(parcelas) : "—";
    result["pagamento.parcelas_quantidade"] = result["pagamento_parcelas_quantidade"];
    result["pagamento_parcelas_valor"] = valorBase > 0 ? formatBRL(valorBase) : "—";
    result["pagamento.parcelas_valor"] = result["pagamento_parcelas_valor"];
  }

  const banco = result["pagamento_banco_nome"] || "";
  const condicoes = banco ? `${formaDescrita} via ${banco}` : formaDescrita;
  result["pagamento_condicoes_completas"] = condicoes;
  result["pagamento.condicoes_completas"] = condicoes;

  return result;
}

/**
 * Build DOCUMENT-ONLY enrichment variables.
 * These are vars that only exist in the contract/document context,
 * NOT in the proposal preview. Kept isolated from flattenSnapshot.
 */
function buildDocumentEnrichment(
  cliente: Record<string, any> | null,
  contratoNumero: string,
): Record<string, string> {
  const ctx: Record<string, string> = {};
  const setDual = (flat: string, dotted: string, val: any) => {
    const s = val !== null && val !== undefined && val !== "" ? String(val) : "—";
    ctx[flat] = s;
    ctx[dotted] = s;
  };

  const now = new Date();
  const dataBR = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const dataExtenso = formatDateExtenso(now);

  // Contrato vars
  setDual("contrato_numero", "contrato.numero", contratoNumero);
  setDual("contrato_data", "contrato.data", dataBR);
  setDual("contrato_data_extenso", "contrato.data_extenso", dataExtenso);

  const validade = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  setDual("contrato_validade", "contrato.validade", validade.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));

  // Assinatura vars
  setDual("assinatura_local", "assinatura.local", cliente?.cidade || "—");
  setDual("assinatura_data", "assinatura.data", dataBR);
  setDual("assinatura_data_extenso", "assinatura.data_extenso", dataExtenso);

  // Date legacy
  ctx["data_atual"] = dataBR;
  ctx["data_extenso"] = dataExtenso;

  // Payment enrichment from cliente.payment_composition
  if (cliente?.payment_composition) {
    const payVars = buildPaymentDescription(cliente.payment_composition, null);
    Object.assign(ctx, payVars);
  }

  return ctx;
}

// ── ZIP manipulation (minimal DOCX processing) ────

/** DOCX is a ZIP file; we process XML entries to replace variables */
async function processDocx(
  templateBytes: Uint8Array,
  variables: Record<string, string>,
): Promise<Uint8Array> {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("npm:fflate@0.8.2");

  const unzipped = unzipSync(templateBytes);
  const processed: Record<string, Uint8Array> = {};

  for (const [path, data] of Object.entries(unzipped)) {
    if (path.startsWith("word/") && (path.endsWith(".xml") || path.endsWith(".rels"))) {
      let xmlStr = strFromU8(data);

      // Step 1: Defragment XML runs to consolidate split text
      xmlStr = defragmentXml(xmlStr);

      // Step 2: Normalize [ variable ] / [variable] → {{variable}}
      xmlStr = normalizeVariableFormat(xmlStr);

      // Step 3: Clean up any remaining XML tags trapped inside {{ and }}
      xmlStr = xmlStr.replace(
        /\{\{((?:[^}]|(?:\}[^}]))*?)\}\}/g,
        (fullMatch) => {
          const cleaned = fullMatch.replace(/<[^>]+>/g, "");
          return cleaned;
        },
      );

      xmlStr = replaceVars(xmlStr, variables);

      // Step 5: Evaluate inline IF()/SWITCH() formulas after variable substitution
      xmlStr = evaluateInlineFormulas(xmlStr);

      // Step 6: Final cleanup — remove any residual placeholders so they appear blank in PDF
      xmlStr = xmlStr.replace(/\{\{[^}]+\}\}/g, "");
      xmlStr = xmlStr.replace(/\[[a-zA-Z_][a-zA-Z0-9_.]*\]/g, "");

      processed[path] = strToU8(xmlStr);
    } else {
      processed[path] = data;
    }
  }

  return zipSync(processed, { level: 6 });
}

// ── Main handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { template_id, deal_id, generated_doc_id } = await req.json();

    if (!template_id || !deal_id) {
      return new Response(
        JSON.stringify({ error: "template_id e deal_id são obrigatórios" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let tenantId: string | null = null;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;
      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();
        tenantId = profile?.tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Tenant não identificado" }),
        { status: 401, headers: jsonHeaders },
      );
    }

    // 1. Load template metadata
    const { data: template, error: tplErr } = await supabase
      .from("document_templates")
      .select("id, nome, docx_storage_path, categoria, version")
      .eq("id", template_id)
      .single();

    if (tplErr || !template) {
      return new Response(
        JSON.stringify({ error: "Template não encontrado" }),
        { status: 404, headers: jsonHeaders },
      );
    }

    if (!template.docx_storage_path) {
      return new Response(
        JSON.stringify({ error: "Template sem arquivo DOCX configurado" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // 2. Download template DOCX from storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("document-files")
      .download(template.docx_storage_path);

    if (dlErr || !fileData) {
      console.error("[generate-document] Download error:", dlErr);
      return new Response(
        JSON.stringify({ error: `Erro ao baixar template: ${dlErr?.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    const templateBytes = new Uint8Array(await fileData.arrayBuffer());
    // 3. Load data for variable resolution (parallel queries)
    //    SAME pattern as template-preview — fetch all related entities
    const { data: projeto } = await supabase
      .from("projetos")
      .select("*, cliente_id")
      .eq("id", deal_id)
      .maybeSingle();

    const clienteId = projeto?.cliente_id;

    const [clienteRes, tenantRes, propostaRes, brandRes, contratoCountRes, consultorRes] = await Promise.all([
      clienteId
        ? supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("tenants").select("nome, documento, telefone, email, endereco").eq("id", tenantId).maybeSingle(),
      // Get latest official proposal version for this deal
      supabase
        .from("proposta_versoes")
        .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
        .eq("proposta_id", deal_id)
        .eq("status", "generated")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => {
          if (!r.data) {
            return supabase
              .from("propostas_nativas")
              .select("id")
              .eq("projeto_id", deal_id)
              .in("status", ["gerada", "aceita", "enviada", "vista"])
              .order("is_principal", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
              .then((pRes) => {
                if (!pRes.data) return { data: null };
                return supabase
                  .from("proposta_versoes")
                  .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
                  .eq("proposta_id", pRes.data.id)
                  .eq("status", "generated")
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
              });
          }
          return r;
        }),
      // Brand settings (representante legal)
      supabase
        .from("brand_settings")
        .select("logo_url, representante_legal, representante_cpf, representante_cargo")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      // Count existing generated documents for contrato.numero
      supabase
        .from("generated_documents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      // Consultor (if projeto has consultor reference)
      projeto?.consultor_id
        ? supabase.from("consultores").select("nome, telefone, email, codigo").eq("id", projeto.consultor_id).eq("tenant_id", tenantId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Also try to get proposta metadata for propostaData context
    let propostaData: Record<string, any> | null = null;
    if (propostaRes.data) {
      // Try to find the proposta_nativa linked to this deal
      const { data: propNativa } = await supabase
        .from("propostas_nativas")
        .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
        .eq("projeto_id", deal_id)
        .in("status", ["gerada", "aceita", "enviada", "vista"])
        .order("is_principal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      propostaData = propNativa;
    }

    // Also fetch lead if available
    const leadId = propostaData?.lead_id || projeto?.lead_id;
    const leadRes = leadId
      ? await supabase.from("leads").select("*").eq("id", leadId).eq("tenant_id", tenantId).maybeSingle()
      : { data: null };

    // Generate contrato number (zero-padded sequential)
    const contratoCount = (contratoCountRes.count ?? 0) + 1;
    const contratoNumero = String(contratoCount).padStart(4, "0");

    // ══════════════════════════════════════════════════════════
    // 4. UNIFIED VARIABLE RESOLUTION — SAME BASE AS template-preview
    //    Uses flattenSnapshot + domain resolvers as SSOT.
    //    NO buildContext(). NO local manual mapping.
    // ══════════════════════════════════════════════════════════

    const snapshot = propostaRes.data?.snapshot as Record<string, unknown> | null;
    const consultor = consultorRes.data;

    const variables = flattenSnapshot(snapshot, {
      lead: leadRes.data,
      cliente: clienteRes.data,
      projeto: projeto,
      consultor: consultor,
      tenantNome: tenantRes.data?.nome,
      versaoData: propostaRes.data as Record<string, unknown>,
      propostaData: propostaData as Record<string, unknown>,
      brandSettings: (brandRes.data ?? {}) as Record<string, unknown>,
      projetoData: (projeto ?? {}) as Record<string, unknown>,
      clienteData: (clienteRes.data ?? {}) as Record<string, unknown>,
    });

    // ── 4b. DOCUMENT-ONLY ENRICHMENT (isolated, does not contaminate flatten) ──
    const docEnrichment = buildDocumentEnrichment(clienteRes.data, contratoNumero);
    for (const [k, v] of Object.entries(docEnrichment)) {
      // Document vars override only if key not already present (preserves 0, "", false)
      if (!(k in variables)) {
        variables[k] = v;
      }
    }

    // ── 4c. POST-PROCESSING (SAME fixes as template-preview — keep in sync!) ──

    // FIX 1: potencia_sistema — strip unit suffix to avoid "6,00 kWp kWp"
    if (variables["potencia_sistema"]) {
      variables["potencia_sistema"] = variables["potencia_sistema"]
        .replace(/\s*kWp\s*$/i, "")
        .trim();
    }

    // FIX 2: subgrupo / grupo_tarifario — ensure top-level keys exist
    const ucsArr = Array.isArray((snapshot as any)?.ucs) ? (snapshot as any).ucs : [];
    const uc1 = ucsArr[0] ?? {};
    if (!variables["subgrupo"]) {
      const sg = (snapshot as any)?.subgrupo ?? (snapshot as any)?.grupo_tarifario
        ?? uc1.subgrupo ?? uc1.grupo_tarifario ?? uc1.grupo
        ?? (leadRes.data as any)?.subgrupo_tarifario;
      if (sg) variables["subgrupo"] = String(sg);
    }
    if (!variables["grupo_tarifario"]) {
      variables["grupo_tarifario"] = variables["subgrupo"] ?? "";
    }

    // FIX 3: estrutura / tipo_telhado — ensure top-level key exists
    if (!variables["estrutura"]) {
      const est = uc1.tipo_telhado ?? (snapshot as any)?.tecnico?.tipo_telhado
        ?? (snapshot as any)?.tipo_telhado ?? variables["tipo_telhado"]
        ?? variables["estrutura_tipo"];
      if (est) variables["estrutura"] = String(est);
    }

    // FIX 4: vc_observacao — never show "N/A" literally
    if (!variables["vc_observacao"] || variables["vc_observacao"] === "N/A" || variables["vc_observacao"] === "n/a") {
      variables["vc_observacao"] = "";
    }

    // 5. Process DOCX — replace variables
    const filledDocx = await processDocx(templateBytes, variables);

    // 6. Save filled DOCX to storage
    const timestamp = Date.now();
    const safeName = template.nome.replace(/[^a-zA-Z0-9_\-\sÀ-ú]/g, "").replace(/\s+/g, "_");
    const docxPath = `${tenantId}/deals/${deal_id}/generated/${timestamp}_${safeName}.docx`;

    const { error: uploadErr } = await supabase.storage
      .from("document-files")
      .upload(docxPath, filledDocx, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[generate-document] Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ error: `Erro ao salvar DOCX: ${uploadErr.message}` }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // 7. Convert DOCX to PDF via Gotenberg
    let pdfPath: string | null = null;

    if (isCircuitOpen(circuitState)) {
      console.warn("[generate-document] Circuit breaker OPEN — skipping PDF conversion");
    } else {
      try {
        const formData = new FormData();
        const blob = new Blob([filledDocx], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        formData.append("files", blob, `${safeName}.docx`);
        formData.append("landscape", "false");
        formData.append("nativePageRanges", "1-");
        formData.append("losslessImageCompression", "true");
        formData.append("reduceImageResolution", "false");
        formData.append("quality", "100");
        formData.append("exportFormFields", "false");
        formData.append("skipEmptyPages", "true");

        const GOTENBERG_URL = await resolveGotenbergUrl(supabase, tenantId);
        const conversionUrl = `${GOTENBERG_URL}/forms/libreoffice/convert`;
        const response = await withRetry(
          async () => {
            const res = await fetchWithTimeout(
              conversionUrl,
              { method: "POST", body: formData },
              90000,
            );
            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Gotenberg ${res.status}: ${errorText}`);
            }
            return res;
          },
          {
            maxRetries: 2,
            baseDelayMs: 1000,
            onRetry: (attempt, err) => {
              console.warn(`[generate-document] PDF retry ${attempt}/2: ${sanitizeError(err)}`);
            },
          },
        ).catch((err) => {
          circuitState = recordFailure(circuitState);
          console.error(`[generate-document] PDF conversion failed. Circuit: failures=${circuitState.failures}`);
          updateHealthCache(supabase, "gotenberg", "down", {
            error_message: sanitizeError(err),
            metadata: { circuit_state: circuitState },
          });
          throw err;
        });

        if (circuitState.failures > 0) {
          circuitState = resetCircuit();
          updateHealthCache(supabase, "gotenberg", "up", {});
        }

        const pdfBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);
        pdfPath = docxPath.replace(/\.docx$/, ".pdf");
        const { error: pdfUploadErr } = await supabase.storage
          .from("document-files")
          .upload(pdfPath, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (pdfUploadErr) {
          console.error("[generate-document] PDF upload error:", pdfUploadErr);
          pdfPath = null;
        }
      } catch (pdfErr: any) {
        console.error("[generate-document] PDF conversion error (non-fatal):", pdfErr?.message);
      }
    }

    // 8. Update or insert generated_documents record
    const docRecord: Record<string, any> = {
      tenant_id: tenantId,
      deal_id: deal_id,
      template_id: template_id,
      template_version: template.version || 1,
      title: template.nome,
      status: "generated",
      docx_filled_path: docxPath,
      pdf_filled_path: pdfPath,
      input_payload: variables,
      updated_by: userId,
    };

    if (clienteId) docRecord.cliente_id = clienteId;
    if (projeto?.id) docRecord.projeto_id = projeto.id;

    let docId = generated_doc_id;

    if (docId) {
      const { error: updErr } = await supabase
        .from("generated_documents")
        .update({
          ...docRecord,
          updated_at: new Date().toISOString(),
        })
        .eq("id", docId);

      if (updErr) {
        console.error("[generate-document] Update error:", updErr);
      }
    } else {
      docRecord.created_by = userId;
      const { data: inserted, error: insErr } = await supabase
        .from("generated_documents")
        .insert(docRecord)
        .select("id")
        .single();

      if (insErr) {
        console.error("[generate-document] Insert error:", insErr);
        return new Response(
          JSON.stringify({ error: `Erro ao salvar registro: ${insErr.message}` }),
          { status: 500, headers: jsonHeaders },
        );
      }
      docId = inserted.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id: docId,
        docx_path: docxPath,
        pdf_path: pdfPath,
        variables_count: Object.keys(variables).length,
      }),
      { headers: jsonHeaders },
    );
  } catch (err: any) {
    console.error("[generate-document] Error:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno" }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
