// generate-recibo-pdf
// Gera o PDF do recibo via Gotenberg (Chromium HTML→PDF) e salva em
// storage `recibos/{tenant_id}/{recibo_id}.pdf`. Atualiza pdf_path.
//
// Input: { recibo_id: string }
// Output: { pdf_path, signed_url }

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
  if (!iso) return "";
  try {
    // Aceita ISO completo ou YYYY-MM-DD (parse local pra evitar shift de timezone)
    const s = String(iso);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
    const d = new Date(dateOnly);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function fmtCpfCnpj(raw: string | null | undefined): string {
  if (!raw) return "";
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
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(raw);
}

function fmtCep(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = String(raw).replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return String(raw);
}

function valorPorExtenso(valor: number): string {
  // Versão compacta: gera "X reais e Y centavos"
  const n = Math.round((Number(valor) || 0) * 100);
  const reais = Math.floor(n / 100);
  const centavos = n % 100;
  const u = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const d = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const c = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  function ate999(x: number): string {
    if (x === 0) return "";
    if (x === 100) return "cem";
    const cs = Math.floor(x / 100);
    const r = x % 100;
    const ds = Math.floor(r / 10);
    const us = r % 10;
    const parts: string[] = [];
    if (cs) parts.push(c[cs]);
    if (r < 20 && r > 0) parts.push(u[r]);
    else {
      if (ds) parts.push(d[ds]);
      if (us) parts.push(u[us]);
    }
    return parts.filter(Boolean).join(" e ");
  }
  function extenso(x: number): string {
    if (x === 0) return "zero";
    const milhoes = Math.floor(x / 1_000_000);
    const milhares = Math.floor((x % 1_000_000) / 1000);
    const resto = x % 1000;
    const parts: string[] = [];
    if (milhoes) parts.push(`${milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`}`);
    if (milhares) parts.push(`${milhares === 1 ? "mil" : `${ate999(milhares)} mil`}`);
    if (resto) parts.push(ate999(resto));
    return parts.join(" e ");
  }
  const partes: string[] = [];
  if (reais > 0) partes.push(`${extenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (centavos > 0) partes.push(`${extenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (partes.length === 0) return "zero reais";
  return partes.join(" e ");
}

function buildHtml(opts: {
  recibo: any;
  cliente: any;
  template: any;
  brand: any;
  tenant: any;
}): string {
  const { recibo, cliente, template, brand, tenant } = opts;
  const dados = (recibo.dados_preenchidos ?? {}) as Record<string, unknown>;
  const logoUrl = brand?.logo_url || brand?.logo_small_url || "";
  const primary = brand?.primary_color || "#0f172a";
  const accent = brand?.accent_color || primary;
  const empresaNome =
    (dados["empresa.nome"] as string) ||
    tenant?.razao_social ||
    tenant?.nome ||
    "";
  const empresaCnpj = fmtCpfCnpj(
    (dados["empresa.cnpj"] as string) || tenant?.cnpj || "",
  );
  const empresaTelefone = fmtPhone(tenant?.telefone);
  const empresaContato = [tenant?.email, empresaTelefone].filter(Boolean).join(" • ");

  const valor = Number(recibo.valor ?? 0);
  const valorBRL = fmtBRL(valor);
  const valorExtenso = valorPorExtenso(valor);
  const descricao = recibo.descricao || (dados["descricao"] as string) || "";
  const numero = recibo.numero || (recibo.id?.slice(0, 8).toUpperCase() ?? "");
  const dataEmissao = fmtDate(recibo.emitido_em || recibo.created_at);
  const dataPagamento = fmtDate(
    (dados["data_pagamento"] as string) || recibo.emitido_em || recibo.created_at,
  );
  const formaPagamento = (dados["forma_pagamento"] as string) || "";

  // Campos financeiros opcionais conhecidos (renderizados com label amigável)
  const numParcela = dados["numero_parcela"] ?? dados["parcela"];
  const totalParcelas = dados["total_parcelas"] ?? dados["num_parcelas"] ?? dados["numero_parcelas"];
  const valorTotalVenda = dados["valor_total_venda"] ?? dados["valor_venda"] ?? dados["valor_proposta"];
  const saldoDevedor = dados["saldo_devedor"];
  const referenciaContrato = dados["referencia_contrato"] ?? dados["contrato"];

  const blocoFinanceiro: { label: string; value: string }[] = [];
  if (dataPagamento) blocoFinanceiro.push({ label: "Data do pagamento", value: dataPagamento });
  if (formaPagamento) blocoFinanceiro.push({ label: "Forma de pagamento", value: String(formaPagamento) });
  if (numParcela && totalParcelas) {
    blocoFinanceiro.push({ label: "Parcela", value: `${numParcela} de ${totalParcelas}` });
  } else if (numParcela) {
    blocoFinanceiro.push({ label: "Parcela", value: String(numParcela) });
  }
  if (valorTotalVenda && Number(valorTotalVenda) > 0) {
    blocoFinanceiro.push({ label: "Valor total da venda", value: fmtBRL(Number(valorTotalVenda)) });
  }
  if (saldoDevedor !== undefined && saldoDevedor !== null && saldoDevedor !== "") {
    blocoFinanceiro.push({ label: "Saldo devedor", value: fmtBRL(Number(saldoDevedor)) });
  }
  if (referenciaContrato) {
    blocoFinanceiro.push({ label: "Referência", value: String(referenciaContrato) });
  }

  const blocoFinHtml = blocoFinanceiro.length
    ? `<div class="fin-grid">${blocoFinanceiro
        .map(
          (i) => `
        <div class="fin-item">
          <div class="fin-label">${escapeHtml(i.label)}</div>
          <div class="fin-value">${escapeHtml(i.value)}</div>
        </div>`,
        )
        .join("")}</div>`
    : "";

  const clienteNome = cliente?.nome || "";
  const clienteDoc = fmtCpfCnpj(cliente?.cpf_cnpj);
  const clienteEndereco = [cliente?.cidade, cliente?.estado].filter(Boolean).join(" / ");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo ${escapeHtml(numero)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm 22mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #0f172a; font-size: 11.5px; line-height: 1.55; margin: 0; }
  .brand-bar { height: 6px; background: ${primary}; border-radius: 2px; margin-bottom: 18px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; margin-bottom: 22px; }
  .header .logo-wrap { display: flex; align-items: center; }
  .header img { max-height: 72px; max-width: 220px; object-fit: contain; }
  .header .empresa { text-align: right; max-width: 55%; }
  .header .empresa h2 { margin: 0 0 4px; font-size: 15px; color: #0f172a; letter-spacing: 0.2px; }
  .header .empresa p { margin: 1px 0; font-size: 10px; color: #475569; }

  .hero { background: linear-gradient(135deg, ${primary} 0%, ${accent} 100%); color: #ffffff; padding: 22px 26px; border-radius: 10px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .hero .left .eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75; margin-bottom: 6px; }
  .hero .left h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px; }
  .hero .left .sub { margin-top: 4px; font-size: 10.5px; opacity: 0.9; }
  .hero .right { text-align: right; }
  .hero .right .label { font-size: 9.5px; opacity: 0.8; letter-spacing: 1.5px; text-transform: uppercase; }
  .hero .right .valor { font-size: 28px; font-weight: 700; margin-top: 2px; line-height: 1.1; }
  .hero .right .extenso { font-size: 9.5px; opacity: 0.85; margin-top: 4px; max-width: 240px; font-style: italic; }

  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .meta .item { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .meta .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 4px; }
  .meta .value { font-size: 12px; font-weight: 600; color: #0f172a; }

  .section-title { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: ${primary}; font-weight: 700; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }

  .corpo { text-align: justify; margin: 4px 0 18px; font-size: 11.5px; color: #1e293b; }
  .corpo strong { color: #0f172a; }

  .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0 20px; }
  .fin-item { padding: 9px 12px; background: #f8fafc; border-left: 3px solid ${primary}; border-radius: 4px; }
  .fin-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; }
  .fin-value { font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 2px; }

  .assinatura { margin-top: 56px; display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; }
  .assinatura .bloco { flex: 1; text-align: center; }
  .assinatura .linha { border-top: 1px solid #0f172a; margin: 0 12px 6px; padding-top: 6px; }
  .assinatura .nome { font-weight: 700; font-size: 11.5px; color: #0f172a; }
  .assinatura .papel { font-size: 9.5px; color: #64748b; margin-top: 2px; }

  .auth-box { margin-top: 28px; padding: 12px 14px; border: 1px dashed #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #f8fafc; }
  .auth-box .info { font-size: 9.5px; color: #475569; line-height: 1.5; }
  .auth-box .info strong { color: #0f172a; }
  .auth-box .hash { font-family: 'Courier New', monospace; font-size: 9px; color: #475569; word-break: break-all; }

  .footer { position: fixed; bottom: 8mm; left: 14mm; right: 14mm; font-size: 8.5px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style>
</head>
<body>
  <div class="brand-bar"></div>

  <div class="header">
    <div class="logo-wrap">
      ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(empresaNome)}"/>` : `<div></div>`}
    </div>
    <div class="empresa">
      <h2>${escapeHtml(empresaNome)}</h2>
      ${empresaCnpj ? `<p>CNPJ ${escapeHtml(empresaCnpj)}</p>` : ""}
      ${empresaContato ? `<p>${escapeHtml(empresaContato)}</p>` : ""}
    </div>
  </div>

  <div class="hero">
    <div class="left">
      <div class="eyebrow">Recibo de Pagamento</div>
      <h1>${escapeHtml((template?.nome || "RECIBO").toUpperCase())}</h1>
      <div class="sub">Documento Nº <strong>${escapeHtml(numero)}</strong></div>
    </div>
    <div class="right">
      <div class="label">Valor recebido</div>
      <div class="valor">${escapeHtml(valorBRL)}</div>
      <div class="extenso">(${escapeHtml(valorExtenso)})</div>
    </div>
  </div>

  <div class="meta">
    <div class="item">
      <div class="label">Data de emissão</div>
      <div class="value">${escapeHtml(dataEmissao)}</div>
    </div>
    <div class="item">
      <div class="label">Data do pagamento</div>
      <div class="value">${escapeHtml(dataPagamento || dataEmissao)}</div>
    </div>
    <div class="item">
      <div class="label">Forma de pagamento</div>
      <div class="value">${escapeHtml(formaPagamento || "—")}</div>
    </div>
  </div>

  <div class="section-title">Pagador</div>
  <div class="corpo">
    <strong>${escapeHtml(clienteNome)}</strong>${clienteDoc ? ` — CPF/CNPJ <strong>${escapeHtml(clienteDoc)}</strong>` : ""}${clienteEndereco ? ` &middot; ${escapeHtml(clienteEndereco)}` : ""}
  </div>

  <div class="section-title">Declaração</div>
  <p class="corpo">
    Recebemos de <strong>${escapeHtml(clienteNome)}</strong>${clienteDoc ? `, inscrito(a) no CPF/CNPJ <strong>${escapeHtml(clienteDoc)}</strong>,` : ""}
    a importância de <strong>${escapeHtml(valorBRL)}</strong> <em>(${escapeHtml(valorExtenso)})</em>${descricao ? `, referente a <strong>${escapeHtml(descricao)}</strong>` : ""}.
    Para clareza e validade, firmamos o presente recibo, dando plena, geral e irrevogável quitação do valor ora recebido.
  </p>

  ${blocoFinHtml ? `<div class="section-title">Detalhes financeiros</div>${blocoFinHtml}` : ""}

  <div class="assinatura">
    <div class="bloco">
      <div class="linha"></div>
      <div class="nome">${escapeHtml(empresaNome)}</div>
      <div class="papel">Emissor${empresaCnpj ? ` — CNPJ ${escapeHtml(empresaCnpj)}` : ""}</div>
    </div>
  </div>

  <div class="auth-box">
    <div class="info">
      <strong>Autenticação eletrônica</strong><br/>
      Documento emitido digitalmente. Validade jurídica conforme MP 2.200-2/2001.
    </div>
    <div class="hash">ID ${escapeHtml(recibo.id ?? "")}</div>
  </div>

  <div class="footer">
    ${escapeHtml(empresaNome)}${empresaCnpj ? ` • CNPJ ${escapeHtml(empresaCnpj)}` : ""} &middot; Recibo Nº ${escapeHtml(numero)} &middot; Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))}
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recibo_id } = await req.json();
    if (!recibo_id || typeof recibo_id !== "string") {
      return new Response(
        JSON.stringify({ error: "recibo_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente autenticado para resolver tenant via RLS
    const supaUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await supaUser.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(supabaseUrl, serviceKey);

    // Profile -> tenant
    const { data: profile } = await supa
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    const tenantId = profile?.tenant_id as string | undefined;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não resolvido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recibo, error: recErr } = await supa
      .from("recibos")
      .select("*")
      .eq("id", recibo_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!recibo) {
      return new Response(JSON.stringify({ error: "Recibo não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: cliente }, { data: template }, { data: brand }, { data: tenant }] =
      await Promise.all([
        supa.from("clientes").select("id, nome, cpf_cnpj, email, telefone").eq("id", recibo.cliente_id).maybeSingle(),
        supa.from("document_templates").select("id, nome").eq("id", recibo.template_id).maybeSingle(),
        supa.from("brand_settings").select("logo_url, logo_small_url").eq("tenant_id", tenantId).maybeSingle(),
        supa.from("tenants").select("nome, razao_social, cnpj, email, telefone").eq("id", tenantId).maybeSingle(),
      ]);

    const html = buildHtml({ recibo, cliente, template, brand, tenant });

    // Gotenberg
    const gotenbergUrl = await resolveGotenbergUrl(supa, tenantId);
    const form = new FormData();
    form.append(
      "files",
      new Blob([html], { type: "text/html" }),
      "index.html",
    );
    const gResp = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
      method: "POST",
      body: form,
    });
    if (!gResp.ok) {
      const t = await gResp.text();
      throw new Error(`Gotenberg ${gResp.status}: ${t.slice(0, 200)}`);
    }
    const pdfBytes = new Uint8Array(await gResp.arrayBuffer());

    const pdfPath = `${tenantId}/${recibo.id}.pdf`;
    const { error: upErr } = await supa.storage
      .from("recibos")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (upErr) throw upErr;

    await supa
      .from("recibos_emitidos")
      .update({ pdf_path: pdfPath, updated_at: new Date().toISOString() })
      .eq("id", recibo.id)
      .eq("tenant_id", tenantId);

    const { data: signed } = await supa.storage
      .from("recibos")
      .createSignedUrl(pdfPath, 60 * 5);

    return new Response(
      JSON.stringify({ pdf_path: pdfPath, signed_url: signed?.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[generate-recibo-pdf] error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
