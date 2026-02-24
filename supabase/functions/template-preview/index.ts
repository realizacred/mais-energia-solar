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
    const { template_id, proposta_id, lead_id: bodyLeadId } = body;

    if (!template_id) {
      return jsonError("template_id é obrigatório", 400);
    }
    if (!proposta_id && !bodyLeadId) {
      return jsonError("proposta_id ou lead_id é obrigatório", 400);
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

    // ── 4. RESOLVER PROPOSTA → LEAD/CLIENTE/PROJETO ───────
    let leadId = bodyLeadId;
    let propostaData: any = null;
    let versaoData: any = null;

    if (proposta_id) {
      const { data: proposta, error: propErr } = await adminClient
        .from("propostas_nativas")
        .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
        .eq("id", proposta_id)
        .eq("tenant_id", tenantId)
        .single();

      if (propErr || !proposta) return jsonError("Proposta não encontrada neste tenant", 404);
      propostaData = proposta;
      leadId = proposta.lead_id;

      // Buscar versão mais recente com snapshot
      const { data: versao } = await adminClient
        .from("proposta_versoes")
        .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      versaoData = versao;
    }

    // ── 5. BUSCAR DADOS RELACIONADOS ──────────────────────
    const [leadRes, clienteRes, projetoRes, consultorRes] = await Promise.all([
      leadId
        ? adminClient
            .from("leads")
            .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, cep, rua, numero, bairro, area, tipo_telhado, rede_atendimento, consumo_previsto, observacoes")
            .eq("id", leadId)
            .eq("tenant_id", tenantId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.cliente_id
        ? adminClient
            .from("clientes")
            .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto, empresa, complemento, data_nascimento, numero_placas, modelo_inversor")
            .eq("id", propostaData.cliente_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.projeto_id
        ? adminClient
            .from("projetos")
            .select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento")
            .eq("id", propostaData.projeto_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.consultor_id
        ? adminClient
            .from("consultores")
            .select("nome, telefone, email, codigo")
            .eq("id", propostaData.consultor_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const lead = leadRes.data;
    const cliente = clienteRes.data;
    const projeto = projetoRes.data as any;
    const consultor = consultorRes.data as any;

    // ── 6. MONTAR MAPA DE VARIÁVEIS ───────────────────────
    const now = new Date();
    const fmtCur = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const vars: Record<string, string> = {};

    // 6a. Se tiver snapshot, ele é a fonte primária (contém TODOS os cálculos)
    const snapshot = versaoData?.snapshot as Record<string, any> | null;
    if (snapshot && typeof snapshot === "object") {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value !== null && value !== undefined && value !== "") {
          vars[key] = String(value);
        }
      }
    }

    // 6b. Sobrescrever/complementar com dados estruturados
    const set = (legacy: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") {
        vars[legacy] = String(value);
      }
    };

    // Cliente
    set("cliente_nome", cliente?.nome || lead?.nome);
    set("cliente_celular", cliente?.telefone || lead?.telefone);
    set("cliente_email", cliente?.email);
    set("cliente_cnpj_cpf", cliente?.cpf_cnpj);
    set("cliente_empresa", cliente?.empresa);
    set("cliente_cep", cliente?.cep || lead?.cep);
    set("cliente_endereco", cliente?.rua || lead?.rua);
    set("cliente_numero", cliente?.numero || lead?.numero);
    set("cliente_complemento", cliente?.complemento);
    set("cliente_bairro", cliente?.bairro || lead?.bairro);
    set("cliente_cidade", cliente?.cidade || lead?.cidade);
    set("cliente_estado", cliente?.estado || lead?.estado);

    // Entrada
    set("consumo_mensal", lead?.media_consumo);
    set("cidade", cliente?.cidade || lead?.cidade);
    set("estado", cliente?.estado || lead?.estado);
    set("tipo_telhado", lead?.tipo_telhado);
    set("cape_telhado", lead?.tipo_telhado);
    set("fase", lead?.rede_atendimento);
    set("dis_energia", ""); // Distribuidora - será do snapshot se existir

    // Sistema Solar
    const potencia = versaoData?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp;
    set("potencia_sistema", potencia ? `${potencia} kWp` : undefined);
    set("potencia_si", potencia ? `${potencia} kWp` : undefined);
    set("modulo_quantidade", projeto?.numero_modulos || cliente?.numero_placas);
    set("inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor);
    set("modulo_modelo", projeto?.modelo_modulos);
    set("geracao_mensal", projeto?.geracao_mensal_media_kwh);

    // Financeiro
    const valorTotal = versaoData?.valor_total || projeto?.valor_total || lead?.valor_estimado || cliente?.valor_projeto;
    if (valorTotal) {
      set("valor_total", fmtCur(valorTotal));
      set("preco_final", fmtCur(valorTotal));
      set("preco_total", fmtCur(valorTotal));
      set("vc_a_vista", fmtCur(valorTotal));
    }
    if (versaoData?.economia_mensal) {
      set("economia_mensal", fmtCur(versaoData.economia_mensal));
    }
    if (versaoData?.payback_meses != null) {
      set("payback", `${versaoData.payback_meses} meses`);
      set("payback_meses", String(versaoData.payback_meses));
    }

    // Comercial
    set("proposta_data", now.toLocaleDateString("pt-BR"));
    set("proposta_titulo", propostaData?.titulo || cliente?.nome || lead?.nome);
    set("proposta_identificador", propostaData?.codigo);
    const validadeDias = versaoData?.validade_dias || 15;
    set("proposta_validade", new Date(now.getTime() + validadeDias * 86400000).toLocaleDateString("pt-BR"));

    // Consultor / Responsável
    if (consultor) {
      set("consultor_nome", consultor.nome);
      set("responsavel_nome", consultor.nome);
      set("responsavel_nom", consultor.nome); // typo no template
      set("consultor_telefone", consultor.telefone);
      set("consultor_email", consultor.email);
    }

    // Observações
    set("vc_observacao", lead?.observacoes);

    console.log(`[template-preview] Variables mapped: ${Object.keys(vars).length} keys`);

    // ── 7. BAIXAR O DOCX DO STORAGE ───────────────────────
    console.log(`[template-preview] Downloading DOCX from: ${template.file_url}`);

    const docxResponse = await fetch(template.file_url);
    if (!docxResponse.ok) {
      return jsonError(`Erro ao baixar template DOCX: ${docxResponse.status}`, 500);
    }
    const templateBuffer = await docxResponse.arrayBuffer();

    // ── 8. PROCESSAR COM docx-templates ───────────────────
    // O template DOCX usa [variavel] com colchetes — definir delimitadores corretos
    console.log(`[template-preview] Processing DOCX with [bracket] delimiters and ${Object.keys(vars).length} variables`);

    const report = await createReport({
      template: new Uint8Array(templateBuffer),
      data: vars,
      cmdDelimiter: ["[", "]"],
      failFast: false,
    });

    // ── 9. RETORNAR O ARQUIVO PROCESSADO ──────────────────
    const clienteNome = cliente?.nome || lead?.nome || "preview";
    const fileName = `preview_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${clienteNome.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;

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
