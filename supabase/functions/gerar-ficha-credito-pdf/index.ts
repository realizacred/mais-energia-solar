import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtBRL(v: number | string | null | undefined): string {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function fmtCpfCnpj(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return String(raw);
}

function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(raw);
}

function buildHtml(opts: {
  analysis: any;
  tenant: any;
  brand: any;
  documents: any[];
  creator: any;
}): string {
  const { analysis, tenant, brand, documents, creator } = opts;
  const logoUrl = brand?.logo_url || brand?.logo_small_url || "";
  const primary = brand?.primary_color || "#f97316"; // Laranja padrão se não houver
  const valorTotal = (analysis.kit_fotovoltaico || 0) + (analysis.mao_obra || 0);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${primary}; padding-bottom: 10px; margin-bottom: 20px; }
  .header img { max-height: 50px; }
  .header .title { text-align: right; }
  .header h1 { margin: 0; font-size: 16px; color: ${primary}; text-transform: uppercase; }
  .header p { margin: 2px 0; font-size: 9px; color: #64748b; }
  
  .section { margin-bottom: 20px; }
  .section-title { background: #f8fafc; padding: 6px 10px; border-left: 4px solid ${primary}; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; margin-bottom: 10px; }
  
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { margin-bottom: 6px; }
  .label { font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; }
  .value { font-size: 11px; font-weight: 500; color: #0f172a; }
  
  .footer { position: fixed; bottom: 0; width: 100%; border-top: 1px solid #e2e8f0; padding-top: 5px; text-align: center; font-size: 8px; color: #94a3b8; }
  
  .doc-list { list-style: none; padding: 0; margin: 0; }
  .doc-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
  .doc-status { font-size: 9px; font-weight: bold; }
  .status-entregue { color: #10b981; }
  .status-pendente { color: #f59e0b; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" />` : `<strong>${escapeHtml(tenant?.nome)}</strong>`}
    </div>
    <div class="title">
      <h1>Ficha de Análise de Crédito</h1>
      <p>Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
      <p>Protocolo: ${escapeHtml(analysis.id.slice(0, 8).toUpperCase())}</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Dados do Cliente</div>
    <div class="grid">
      <div class="field"><span class="label">Nome/Razão Social</span><span class="value">${escapeHtml(analysis.cliente_nome || analysis.razao_social || "—")}</span></div>
      <div class="field"><span class="label">CPF/CNPJ</span><span class="value">${fmtCpfCnpj(analysis.cpf_cnpj || analysis.cnpj)}</span></div>
      <div class="field"><span class="label">Data de Nascimento</span><span class="value">${fmtDate(analysis.cliente_data_nascimento)}</span></div>
      <div class="field"><span class="label">Telefone</span><span class="value">${fmtPhone(analysis.cliente_telefone)}</span></div>
      <div class="field"><span class="label">E-mail</span><span class="value">${escapeHtml(analysis.cliente_email)}</span></div>
      <div class="field"><span class="label">Renda Mensal</span><span class="value">${fmtBRL(analysis.renda_mensal)}</span></div>
      <div class="field"><span class="label">Patrimônio Estimado</span><span class="value">${fmtBRL(analysis.patrimonio)}</span></div>
      <div class="field"><span class="label">Tipo de Pessoa</span><span class="value">${analysis.tipo_pessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Dados do Projeto</div>
    <div class="grid">
      <div class="field"><span class="label">Valor do Kit</span><span class="value">${fmtBRL(analysis.kit_fotovoltaico)}</span></div>
      <div class="field"><span class="label">Mão de Obra</span><span class="value">${fmtBRL(analysis.mao_obra)}</span></div>
      <div class="field"><span class="label">Valor Total</span><span class="value">${fmtBRL(valorTotal)}</span></div>
      <div class="field"><span class="label">Potência Instalada</span><span class="value">${analysis.potencia_instalada} kWp</span></div>
      <div class="field"><span class="label">Média Conta de Energia</span><span class="value">${fmtBRL(analysis.media_conta_energia)}</span></div>
      <div class="field"><span class="label">Área de Instalação</span><span class="value">${analysis.area_instalacao} m²</span></div>
      <div class="field"><span class="label">Situação do Imóvel</span><span class="value">${escapeHtml(analysis.situacao_imovel)}</span></div>
      <div class="field">
        <span class="label">Endereço de Instalação</span>
        <span class="value">${escapeHtml(analysis.endereco_logradouro)}, ${escapeHtml(analysis.endereco_numero)}${analysis.endereco_complemento ? ` - ${analysis.endereco_complemento}` : ""}<br/>
        ${escapeHtml(analysis.endereco_bairro)} - ${escapeHtml(analysis.endereco_cidade)}/${escapeHtml(analysis.endereco_estado)} - CEP: ${escapeHtml(analysis.endereco_cep)}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Condições Solicitadas</div>
    <div class="grid">
      <div class="field"><span class="label">Banco Destino</span><span class="value">${escapeHtml(analysis.banco)}</span></div>
      <div class="field"><span class="label">Valor a Financiar</span><span class="value">${fmtBRL(analysis.valor_solicitado)}</span></div>
      <div class="field"><span class="label">Prazo</span><span class="value">${analysis.prazo_meses} meses</span></div>
      <div class="field"><span class="label">Carência</span><span class="value">${analysis.carencia} meses</span></div>
      <div class="field"><span class="label">Seguro Incluso?</span><span class="value">${analysis.com_seguro ? "Sim" : "Não"}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Documentos Vinculados</div>
    <div class="doc-list">
      ${documents.length === 0 ? '<p class="text-muted">Nenhum documento anexado.</p>' : documents.map(doc => `
        <div class="doc-item">
          <span>${escapeHtml(doc.project_documents?.display_name || doc.project_documents?.file_name || "Documento")}</span>
          <span class="doc-status status-entregue">✓ ENTREGUE</span>
        </div>
      `).join("")}
    </div>
  </div>

  <div class="footer">
    Documento gerado em ${new Date().toLocaleString("pt-BR")} por ${escapeHtml(creator?.nome || "Sistema")} <br/>
    via <strong>${escapeHtml(tenant?.nome)}</strong> — Uso exclusivo para análise de crédito
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { analise_credito_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(supabaseUrl, serviceKey);

    const { data: analysis, error: anErr } = await supa
      .from("analise_credito")
      .select("*")
      .eq("id", analise_credito_id)
      .single();
    if (anErr || !analysis) throw new Error("Análise não encontrada");

    const tenantId = analysis.tenant_id;

    const [
      { data: tenant },
      { data: brand },
      { data: documents },
      { data: creator }
    ] = await Promise.all([
      supa.from("tenants").select("*").eq("id", tenantId).single(),
      supa.from("brand_settings").select("*").eq("tenant_id", tenantId).maybeSingle(),
      supa.from("analise_credito_documentos").select("*, project_documents(*)").eq("analise_credito_id", analise_credito_id),
      supa.from("profiles").select("nome").eq("user_id", analysis.criado_por).maybeSingle()
    ]);

    const html = buildHtml({ analysis, tenant, brand, documents: documents || [], creator });

    const gotenbergUrl = await resolveGotenbergUrl(supa, tenantId);
    const form = new FormData();
    form.append("files", new Blob([html], { type: "text/html" }), "index.html");
    
    const gResp = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: "POST",
      body: form,
    });

    if (!gResp.ok) throw new Error(`Gotenberg error: ${await gResp.text()}`);
    
    const pdfBytes = new Uint8Array(await gResp.arrayBuffer());
    const filePath = `fichas-credito/${tenantId}/${analise_credito_id}/ficha.pdf`;

    const { error: upErr } = await supa.storage
      .from("documents")
      .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (upErr) throw upErr;

    const { data: { publicUrl } } = supa.storage.from("documents").getPublicUrl(filePath);

    await supa
      .from("analise_credito")
      .update({ snapshot_data: { ...analysis.snapshot_data, ficha_pdf_url: publicUrl } as any })
      .eq("id", analise_credito_id);

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
