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
import { processXmlContent, shouldProcessXmlFile } from "../_shared/docxProcessor.ts";
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

/** Format monetary value in pt-BR without currency symbol */
function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseLocaleNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw
    .replace(/R\$/gi, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInversorItem(item: Record<string, any>): boolean {
  const categoria = String(item?.categoria ?? "").toLowerCase();
  const tipo = String(item?.tipo ?? "").toLowerCase();
  return categoria.includes("inversor") || categoria === "inverter" || tipo.includes("inversor");
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
  snapshot?: Record<string, any> | null,
  versaoData?: Record<string, any> | null,
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

  // ── doc_* aliases for contract templates ──
  // doc_parcelas / doc_valor_das_parcelas from snapshot payment data
  const snap = snapshot ?? {};
  const pagOpcoes = snap.pagamentoOpcoes ?? snap.pagamento_opcoes ?? (snap as any)?._wizard_state?.pagamentoOpcoes;
  if (Array.isArray(pagOpcoes) && pagOpcoes.length > 0) {
    // Find the active/first financing option
    const fin = pagOpcoes.find((p: any) => p.tipo === "financiamento" || p.tipo === "parcelado") ?? pagOpcoes[0];
    const numParcelas = fin?.num_parcelas ?? fin?.numParcelas ?? fin?.prazo ?? fin?.parcelas;
    const valorParcela = fin?.valor_parcela ?? fin?.valorParcela ?? fin?.parcela ?? fin?.valor_mensal;
    if (numParcelas) ctx["doc_parcelas"] = String(numParcelas);
    const valorParcelaNum = parseLocaleNumber(valorParcela);
    if (valorParcelaNum != null) ctx["doc_valor_das_parcelas"] = formatBRL(valorParcelaNum);
  }

  // Fallback from versaoData or snapshot direct fields
  if (!ctx["doc_parcelas"]) {
    const fp = snap.f_parcelas ?? snap.f_ativo_prazo ?? versaoData?.f_parcelas;
    if (fp) ctx["doc_parcelas"] = String(fp);
  }
  if (!ctx["doc_valor_das_parcelas"]) {
    const fv = snap.f_valor_parcela ?? snap.f_ativo_parcela;
    const fvNum = parseLocaleNumber(fv);
    if (fvNum != null) ctx["doc_valor_das_parcelas"] = formatBRL(fvNum);
  }

  return ctx;
}

// ── ZIP manipulation — uses shared DOCX pipeline (RB-39, DA-21) ────

/** DOCX is a ZIP file; we process XML entries using the shared pipeline */
async function processDocx(
  templateBytes: Uint8Array,
  variables: Record<string, string>,
): Promise<Uint8Array> {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("npm:fflate@0.8.2");

  const unzipped = unzipSync(templateBytes);
  const processed: Record<string, Uint8Array> = {};

  for (const [path, data] of Object.entries(unzipped)) {
    if (shouldProcessXmlFile(path)) {
      const xmlStr = strFromU8(data);
      const result = processXmlContent(xmlStr, variables);
      processed[path] = strToU8(result);
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
    const clienteSelect = [
      "id",
      "tenant_id",
      "nome",
      "telefone",
      "email",
      "cpf_cnpj",
      "empresa",
      "cep",
      "rua",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "estado",
      "data_nascimento",
      "observacoes",
      "potencia_kwp",
      "valor_projeto",
      "data_instalacao",
      "numero_placas",
      "modelo_inversor",
      "payment_composition",
    ].join(", ");

    const [clienteRes, tenantRes, propostaRes, brandRes, contratoCountRes, consultorRes] = await Promise.all([
      clienteId
        ? supabase.from("clientes").select(clienteSelect).eq("id", clienteId).eq("tenant_id", tenantId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("tenants").select("nome, documento, telefone, email, endereco").eq("id", tenantId).maybeSingle(),
      // Get PRINCIPAL proposal for this project, then its latest version
      // Step 1: find propostas_nativas with is_principal=true first, fallback to any accepted/generated
      (async () => {
        // Try is_principal=true first with status filter
        let { data: propNativa } = await supabase
          .from("propostas_nativas")
          .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id, is_principal")
          .or(`deal_id.eq.${deal_id},projeto_id.eq.${deal_id}`)
          .eq("is_principal", true)
          .in("status", ["gerada", "aceita"])
          .limit(1)
          .maybeSingle();

        // Fallback: any proposal with relevant status ordered by priority
        if (!propNativa) {
          const { data: fallback } = await supabase
            .from("propostas_nativas")
            .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id, is_principal")
            .or(`deal_id.eq.${deal_id},projeto_id.eq.${deal_id}`)
            .in("status", ["gerada", "aceita", "enviada", "vista"])
            .order("is_principal", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          propNativa = fallback;
        }

        if (!propNativa) return { data: null, propNativa: null };

        const { data: versao } = await supabase
          .from("proposta_versoes")
          .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
          .eq("proposta_id", propNativa.id)
          .eq("status", "generated")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return { data: versao, propNativa };
      })(),
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

    // Extract proposta metadata from the combined result
    const propostaData: Record<string, any> | null = (propostaRes as any)?.propNativa ?? null;

    let clienteData = clienteRes.data;
    if (!clienteData && propostaData?.cliente_id) {
      const clienteFallbackRes = await supabase
        .from("clientes")
        .select(clienteSelect)
        .eq("id", propostaData.cliente_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      clienteData = clienteFallbackRes.data ?? null;
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
      cliente: clienteData,
      projeto: projeto,
      consultor: consultor,
      tenantNome: tenantRes.data?.nome,
      versaoData: propostaRes.data as Record<string, unknown>,
      propostaData: propostaData as Record<string, unknown>,
      brandSettings: (brandRes.data ?? {}) as Record<string, unknown>,
      projetoData: (projeto ?? {}) as Record<string, unknown>,
      clienteData: (clienteData ?? {}) as Record<string, unknown>,
    });

    // ── 4b. DOCUMENT-ONLY ENRICHMENT (isolated, does not contaminate flatten) ──
    const docEnrichment = buildDocumentEnrichment(clienteData, contratoNumero, snapshot as Record<string, any>, propostaRes.data as Record<string, any>);
    for (const [k, v] of Object.entries(docEnrichment)) {
      // Document vars override only if key not already present (preserves 0, "", false)
      if (!(k in variables)) {
        variables[k] = v;
      }
    }

    // ── 4b2. doc_* aliases from already-resolved vars ──
    if (!variables["doc_parcelas"]) variables["doc_parcelas"] = variables["f_ativo_prazo"] ?? variables["f_parcelas"] ?? variables["projeto_numero_parcelas"] ?? "";
    if (!variables["doc_valor_das_parcelas"]) variables["doc_valor_das_parcelas"] = variables["f_ativo_parcela"] ?? variables["f_valor_parcela"] ?? variables["projeto_valor_parcela"] ?? "";

    // ── 4c. POST-PROCESSING (SAME fixes as template-preview — keep in sync!) ──

    // FIX 1: potencia_sistema — ensure "kWp" suffix is present
    if (variables["potencia_sistema"]) {
      const stripped = variables["potencia_sistema"].replace(/\s*kWp\s*$/i, "").trim();
      variables["potencia_sistema"] = stripped ? `${stripped} kWp` : "";
    } else if (variables["potencia_kwp"]) {
      variables["potencia_sistema"] = `${variables["potencia_kwp"]} kWp`;
    }

    // FIX 1b: cliente_cnpj_cpf — ensure it's populated from cliente data
    if (clienteData) {
      const clienteFieldMap: Array<[string, string]> = [
        ["cliente_cnpj_cpf", "cpf_cnpj"],
        ["cliente_cpf_cnpj", "cpf_cnpj"],
        ["cliente_endereco", "rua"],
        ["cliente_numero", "numero"],
        ["cliente_bairro", "bairro"],
        ["cliente_cidade", "cidade"],
        ["cliente_estado", "estado"],
        ["cliente_cep", "cep"],
      ];
      for (const [variableKey, clienteKey] of clienteFieldMap) {
        if (!variables[variableKey] && clienteData?.[clienteKey] != null) {
          variables[variableKey] = String(clienteData[clienteKey]);
        }
      }

      if (!variables["cidade"] && clienteData?.cidade != null) {
        variables["cidade"] = String(clienteData.cidade);
      }
    }

    // FIX 1c: equipamentos_custo_total / instalacao_preco_total from snapshot
    if (!variables["equipamentos_custo_total"] && snapshot) {
      const snap = snapshot as Record<string, any>;
      // Try snapshot.venda or snapshot.itens
      const venda = snap.venda ?? {};
      let equipCusto = parseLocaleNumber(venda.equipamentos_custo_total)
        ?? parseLocaleNumber(venda.custo_equipamentos)
        ?? parseLocaleNumber(venda.equipamentos)
        ?? parseLocaleNumber(snap.equipamentos_custo_total);
      if (!equipCusto && Array.isArray(snap.itens)) {
        equipCusto = snap.itens
          .filter((it: any) => it.categoria !== "servico" && it.categoria !== "instalacao")
          .reduce((sum: number, it: any) => {
            const preco = parseLocaleNumber(it.preco_unitario) ?? parseLocaleNumber(it.preco_venda) ?? 0;
            const quantidade = parseLocaleNumber(it.quantidade) ?? 1;
            return sum + (preco * quantidade);
          }, 0);
      }
      if (equipCusto != null && equipCusto > 0) {
        variables["equipamentos_custo_total"] = formatBRL(equipCusto);
      }
    }
    if (!variables["instalacao_preco_total"] && snapshot) {
      const snap = snapshot as Record<string, any>;
      const venda = snap.venda ?? {};
      let instCusto = parseLocaleNumber(venda.instalacao_preco_total)
        ?? parseLocaleNumber(venda.custo_instalacao)
        ?? parseLocaleNumber(venda.instalacao)
        ?? parseLocaleNumber(snap.instalacao_preco_total)
        ?? parseLocaleNumber(snap.instalacao_custo_total);
      if (instCusto == null && Array.isArray(snap.servicos)) {
        const servicosTotal = snap.servicos.reduce((sum: number, servico: any) => {
          const valor = parseLocaleNumber(servico?.valor)
            ?? parseLocaleNumber(servico?.preco)
            ?? parseLocaleNumber(servico?.preco_unitario)
            ?? 0;
          return sum + valor;
        }, 0);
        if (servicosTotal > 0) instCusto = servicosTotal;
      }
      if (!instCusto && Array.isArray(snap.itens)) {
        instCusto = snap.itens
          .filter((it: any) => it.categoria === "servico" || it.categoria === "instalacao")
          .reduce((sum: number, it: any) => {
            const preco = parseLocaleNumber(it.preco_unitario) ?? parseLocaleNumber(it.preco_venda) ?? 0;
            const quantidade = parseLocaleNumber(it.quantidade) ?? 1;
            return sum + (preco * quantidade);
          }, 0);
      }
      if (instCusto != null && instCusto > 0) {
        variables["instalacao_preco_total"] = formatBRL(instCusto);
      }
    }

    // FIX 1d: modulo_potencia — always suffix with Wp
    if (variables["modulo_potencia"]) {
      const stripped = variables["modulo_potencia"].replace(/\s*Wp\s*$/i, "").trim();
      variables["modulo_potencia"] = stripped ? `${stripped} Wp` : "";
    }

    // FIX 1e: inversores_utilizados — contrato template expects numeric quantity only
    const inverterCountFromItems = Array.isArray((snapshot as Record<string, any> | null)?.itens)
      ? (snapshot as Record<string, any>).itens
          .filter((item: Record<string, any>) => isInversorItem(item))
          .reduce((sum: number, item: Record<string, any>) => sum + (parseLocaleNumber(item.quantidade) ?? 1), 0)
      : 0;
    const inversorQuantidade = variables["inversor_quantidade"]
      ?? (inverterCountFromItems > 0 ? String(inverterCountFromItems) : "");
    if (inversorQuantidade) {
      variables["inversores_utilizados"] = inversorQuantidade;
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
    // TEMP DIAGNOSTIC — remove after debugging
    const diagKeys = ["cliente_cnpj_cpf", "cliente_endereco", "cliente_numero", "cliente_bairro", "cliente_cidade", "cliente_estado", "cliente_cep", "cliente_nome"];
    const diagValues: Record<string, string> = {};
    for (const k of diagKeys) {
      diagValues[k] = variables[k] ?? "(MISSING)";
    }
    console.error("[generate-document] DIAG clienteData:", JSON.stringify({
      clienteId,
      clienteDataExists: !!clienteData,
      clienteDataCpf: clienteData?.cpf_cnpj ?? "(null)",
      clienteDataRua: clienteData?.rua ?? "(null)",
      projetoExists: !!projeto,
      projetoClienteId: projeto?.cliente_id ?? "(null)",
      snapshotExists: !!snapshot,
    }));
    console.error("[generate-document] DIAG variables:", JSON.stringify(diagValues));
    console.error("[generate-document] DIAG total vars count:", Object.keys(variables).length);

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
      pdf_path: pdfPath,
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
