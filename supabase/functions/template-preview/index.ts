import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// @deno-types="https://unpkg.com/docx-templates/lib/bundled.d.ts"
import { createReport } from "https://unpkg.com/docx-templates/lib/browser.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH + TENANT ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonError("Token inválido", 401);
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id || !profile.ativo) return jsonError("Usuário inativo ou sem tenant", 403);
    const tenantId = profile.tenant_id;

    // ── 2. PARSE BODY ─────────────────────────────────────
    const body = await req.json();
    const { template_id, lead_id } = body;

    if (!template_id || !lead_id) {
      return jsonError("template_id e lead_id são obrigatórios", 400);
    }

    // ── 3. BUSCAR TEMPLATE ────────────────────────────────
    const { data: template, error: tmplErr } = await adminClient
      .from("proposta_templates")
      .select("id, nome, tipo, file_url, template_html")
      .eq("id", template_id)
      .eq("tenant_id", tenantId)
      .single();

    if (tmplErr || !template) return jsonError("Template não encontrado neste tenant", 404);
    if (template.tipo !== "docx" || !template.file_url) {
      return jsonError("Template não é DOCX ou não tem arquivo", 400);
    }

    // ── 4. BUSCAR DADOS DO LEAD + CLIENTE ─────────────────
    const [leadRes, clienteRes] = await Promise.all([
      adminClient
        .from("leads")
        .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, cep, rua, numero, bairro, area, tipo_telhado, rede_atendimento, consumo_previsto, observacoes")
        .eq("id", lead_id)
        .eq("tenant_id", tenantId)
        .single(),
      adminClient
        .from("clientes")
        .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto, empresa, complemento, data_nascimento, numero_placas, modelo_inversor")
        .eq("lead_id", lead_id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    if (leadRes.error || !leadRes.data) return jsonError("Lead não encontrado neste tenant", 404);

    const lead = leadRes.data;
    const cliente = clienteRes.data;

    // ── 5. MONTAR MAPA DE VARIÁVEIS ───────────────────────
    const now = new Date();
    const vars: Record<string, string> = {
      // Cliente
      nome_cliente: cliente?.nome || lead.nome || "—",
      telefone_cliente: cliente?.telefone || lead.telefone || "—",
      email_cliente: cliente?.email || "—",
      cpf_cnpj: cliente?.cpf_cnpj || "—",
      empresa: cliente?.empresa || "—",
      data_nascimento: cliente?.data_nascimento || "—",
      // Endereço
      cidade: cliente?.cidade || lead.cidade || "—",
      estado: cliente?.estado || lead.estado || "—",
      bairro: cliente?.bairro || lead.bairro || "—",
      rua: cliente?.rua || lead.rua || "—",
      numero: cliente?.numero || lead.numero || "—",
      cep: cliente?.cep || lead.cep || "—",
      complemento: cliente?.complemento || "—",
      // Consumo / técnico
      consumo_medio: String(lead.media_consumo || 0),
      consumo_previsto: String(lead.consumo_previsto || 0),
      potencia_kwp: String(cliente?.potencia_kwp || 0),
      numero_placas: String(cliente?.numero_placas || 0),
      modelo_inversor: cliente?.modelo_inversor || "—",
      area: lead.area || "—",
      tipo_telhado: lead.tipo_telhado || "—",
      rede_atendimento: lead.rede_atendimento || "—",
      // Financeiro
      valor_total: formatCurrency(lead.valor_estimado || cliente?.valor_projeto || 0),
      valor_projeto: formatCurrency(cliente?.valor_projeto || lead.valor_estimado || 0),
      // Comercial
      data_proposta: now.toLocaleDateString("pt-BR"),
      validade_proposta: new Date(now.getTime() + 15 * 86400000).toLocaleDateString("pt-BR"),
      // Observações
      observacoes: lead.observacoes || "—",
    };

    // ── 6. BAIXAR O DOCX DO STORAGE ───────────────────────
    console.log(`[template-preview] Downloading DOCX from: ${template.file_url}`);

    const docxResponse = await fetch(template.file_url);
    if (!docxResponse.ok) {
      return jsonError(`Erro ao baixar template DOCX: ${docxResponse.status}`, 500);
    }
    const templateBuffer = await docxResponse.arrayBuffer();

    // ── 7. PROCESSAR COM docx-templates ───────────────────
    console.log(`[template-preview] Processing DOCX with ${Object.keys(vars).length} variables`);

    // docx-templates uses {campo} or {INS campo} syntax
    // We also need to handle [campo] and {{grupo.campo}} legacy formats
    // docx-templates expects data as an object where keys match template placeholders
    const report = await createReport({
      template: new Uint8Array(templateBuffer),
      data: vars,
      cmdDelimiter: ["{", "}"],
      failFast: false,
    });

    // ── 8. RETORNAR O ARQUIVO PROCESSADO ──────────────────
    const fileName = `preview_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${lead.nome.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;

    console.log(`[template-preview] Success, returning ${report.length} bytes as ${fileName}`);

    return new Response(report, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[template-preview] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
