/**
 * Edge Function: generate-document
 * Downloads a DOCX template, replaces {{variables}} with real data,
 * saves the filled DOCX to storage, and updates generated_documents.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";
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

/** Format BRL currency */
function formatBRL(v: number | null | undefined): string {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Format date to pt-BR */
function formatDateBR(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return d;
  }
}

/** Build flat variable context from loaded data */
function buildContext(
  cliente: Record<string, any> | null,
  projeto: Record<string, any> | null,
  tenant: Record<string, any> | null,
  proposta: Record<string, any> | null,
): Record<string, string> {
  const ctx: Record<string, string> = {};
  const set = (key: string, val: any) => {
    if (val !== null && val !== undefined && val !== "") {
      ctx[key] = String(val);
    }
  };

  // Cliente
  if (cliente) {
    set("cliente_nome", cliente.nome);
    set("cliente_cpf_cnpj", cliente.cpf_cnpj);
    set("cliente_telefone", cliente.telefone);
    set("cliente_email", cliente.email);
    set("cliente_rg", cliente.identidade_url); // fallback
    set("cliente_data_nascimento", formatDateBR(cliente.data_nascimento));
    const endereco = [cliente.rua, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(", ");
    set("cliente_endereco", endereco);
    set("cliente_rua", cliente.rua);
    set("cliente_numero", cliente.numero);
    set("cliente_bairro", cliente.bairro);
    set("cliente_cidade", cliente.cidade);
    set("cliente_estado", cliente.estado);
    set("cliente_cep", cliente.cep);
    set("cliente_complemento", cliente.complemento);
  }

  // Projeto
  if (projeto) {
    set("potencia_sistema", projeto.potencia_kwp);
    set("potencia_kwp", projeto.potencia_kwp);
    set("modulo_quantidade", projeto.numero_modulos);
    set("modulo_marca", projeto.modelo_modulos);
    set("inversor_modelo", projeto.modelo_inversor);
    set("inversores_utilizados", projeto.numero_inversores);
    set("area_util", projeto.area_util_m2);
    set("geracao_mensal_media", projeto.geracao_mensal_media_kwh);
    set("valor_venda_total", formatBRL(projeto.valor_total));
    set("valor_total", formatBRL(projeto.valor_total));
    set("forma_pagamento", projeto.forma_pagamento);
    set("valor_entrada", formatBRL(projeto.valor_entrada));
    set("valor_financiado", formatBRL(projeto.valor_financiado));
    set("numero_parcelas", projeto.numero_parcelas);
    set("valor_parcela", formatBRL(projeto.valor_parcela));
    set("prazo_estimado_dias", projeto.prazo_estimado_dias);
    set("prazo_vistoria", projeto.prazo_vistoria_dias);
  }

  // Tenant / Empresa
  if (tenant) {
    set("empresa_nome", tenant.nome);
    set("empresa_cnpj", tenant.documento);
    set("empresa_telefone", tenant.telefone);
    set("empresa_email", tenant.email);
    set("empresa_endereco", tenant.endereco);
  }

  // Proposta snapshot (if exists)
  if (proposta) {
    const snap = proposta.snapshot || {};
    // Overlay snapshot vars — they have richer data
    for (const [k, v] of Object.entries(snap)) {
      if (v !== null && v !== undefined && v !== "" && typeof v !== "object") {
        set(k, v);
      }
    }
  }

  // Date vars
  const now = new Date();
  set("data_atual", now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  set("data_extenso", now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }));

  return ctx;
}

// ── ZIP manipulation (minimal DOCX processing) ────

/** DOCX is a ZIP file; we process XML entries to replace variables */
async function processDocx(
  templateBytes: Uint8Array,
  variables: Record<string, string>,
): Promise<Uint8Array> {
  // Use Deno's built-in JSZip-like approach via fflate
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("npm:fflate@0.8.2");

  const unzipped = unzipSync(templateBytes);
  const processed: Record<string, Uint8Array> = {};

  for (const [path, data] of Object.entries(unzipped)) {
    // Only process XML files in word/ directory
    if (path.startsWith("word/") && (path.endsWith(".xml") || path.endsWith(".rels"))) {
      let xmlStr = strFromU8(data);

      // DOCX often splits {{variable}} across multiple XML runs.
      // First, clean up fragmented tags by removing XML tags between {{ and }}
      xmlStr = xmlStr.replace(
        /\{\{((?:[^}]|(?:\}[^}]))*?)\}\}/g,
        (fullMatch) => {
          // Strip XML tags from inside the braces
          const cleaned = fullMatch.replace(/<[^>]+>/g, "");
          return cleaned;
        },
      );

      // Now replace variables
      xmlStr = replaceVars(xmlStr, variables);

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

    console.log(`[generate-document] template=${template_id}, deal=${deal_id}, tenant=${tenantId}`);

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
    console.log(`[generate-document] Template downloaded: ${templateBytes.length} bytes`);

    // 3. Load data for variable resolution (parallel queries)
    const { data: projeto } = await supabase
      .from("projetos")
      .select("*, cliente_id")
      .eq("id", deal_id)
      .maybeSingle();

    const clienteId = projeto?.cliente_id;

    const [clienteRes, tenantRes, propostaRes] = await Promise.all([
      clienteId
        ? supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("tenants").select("nome, documento, telefone, email, endereco").eq("id", tenantId).maybeSingle(),
      // Get latest official proposal version for this deal
      supabase
        .from("proposta_versoes")
        .select("snapshot")
        .eq("proposta_id", deal_id)
        .eq("is_official", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => {
          // Fallback: try by projeto relationship
          if (!r.data) {
            return supabase
              .from("propostas_nativas")
              .select("id")
              .eq("projeto_id", deal_id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
              .then((pRes) => {
                if (!pRes.data) return { data: null };
                return supabase
                  .from("proposta_versoes")
                  .select("snapshot")
                  .eq("proposta_id", pRes.data.id)
                  .eq("is_official", true)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
              });
          }
          return r;
        }),
    ]);

    // 4. Build variable context
    const variables = buildContext(
      clienteRes.data,
      projeto,
      tenantRes.data,
      propostaRes.data,
    );

    console.log(`[generate-document] Variables resolved: ${Object.keys(variables).length} keys`);

    // 5. Process DOCX — replace variables
    const filledDocx = await processDocx(templateBytes, variables);
    console.log(`[generate-document] Filled DOCX: ${filledDocx.length} bytes`);

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

    console.log(`[generate-document] DOCX saved to: ${docxPath}`);

    // 7. Update or insert generated_documents record
    const docRecord: Record<string, any> = {
      tenant_id: tenantId,
      deal_id: deal_id,
      template_id: template_id,
      template_version: template.version || 1,
      title: template.nome,
      status: "generated",
      docx_filled_path: docxPath,
      input_payload: variables,
      updated_by: userId,
    };

    if (clienteId) docRecord.cliente_id = clienteId;
    if (projeto?.id) docRecord.projeto_id = projeto.id;

    let docId = generated_doc_id;

    if (docId) {
      // Update existing record
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
      // Insert new
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

    console.log(`[generate-document] Record saved: ${docId}`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: docId,
        docx_path: docxPath,
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
