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
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
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
  const empresaNome =
    (dados["empresa.nome"] as string) ||
    tenant?.razao_social ||
    tenant?.nome ||
    "";
  const empresaCnpj =
    (dados["empresa.cnpj"] as string) || tenant?.cnpj || "";
  const empresaContato = [tenant?.email, tenant?.telefone]
    .filter(Boolean)
    .join(" • ");

  const valor = Number(recibo.valor ?? 0);
  const descricao = recibo.descricao || (dados["descricao"] as string) || "";
  const numero = recibo.numero || recibo.id?.slice(0, 8).toUpperCase();
  const dataEmissao = fmtDate(recibo.emitido_em || recibo.created_at);

  // Lista campos extras (form_schema fields que não são canônicos)
  const skipKeys = new Set([
    "valor",
    "descricao",
    "empresa.nome",
    "empresa.cnpj",
  ]);
  const extraRows = Object.entries(dados)
    .filter(([k, v]) => !skipKeys.has(k) && v !== null && v !== "" && v !== undefined)
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Recibo ${escapeHtml(numero)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 24px; }
  .header img { max-height: 56px; max-width: 180px; object-fit: contain; }
  .header .empresa { text-align: right; }
  .header .empresa h2 { margin: 0 0 2px; font-size: 14px; }
  .header .empresa p { margin: 0; font-size: 10px; color: #555; }
  h1.titulo { text-align: center; font-size: 22px; letter-spacing: 4px; margin: 8px 0 4px; }
  .numero { text-align: center; font-size: 11px; color: #555; margin-bottom: 24px; }
  .valor-box { border: 1px solid #d0d0d0; background: #f7f7f9; padding: 14px 18px; border-radius: 6px; display: flex; justify-content: space-between; margin: 12px 0 22px; }
  .valor-box .label { font-size: 10px; text-transform: uppercase; color: #555; letter-spacing: 1px; }
  .valor-box .valor { font-size: 22px; font-weight: 700; color: #1a1a1a; }
  .corpo { text-align: justify; margin-bottom: 24px; }
  .corpo strong { color: #000; }
  table.dados { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
  table.dados th, table.dados td { padding: 6px 10px; border: 1px solid #e2e2e2; text-align: left; vertical-align: top; }
  table.dados th { background: #f3f4f6; width: 32%; font-weight: 600; }
  .assinatura { margin-top: 60px; text-align: center; }
  .assinatura .linha { border-top: 1px solid #1a1a1a; width: 70%; margin: 0 auto 6px; }
  .assinatura .nome { font-weight: 600; }
  .footer { position: fixed; bottom: 8mm; left: 16mm; right: 16mm; font-size: 9px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="logo"/>` : `<div></div>`}
    <div class="empresa">
      <h2>${escapeHtml(empresaNome)}</h2>
      ${empresaCnpj ? `<p>CNPJ ${escapeHtml(empresaCnpj)}</p>` : ""}
      ${empresaContato ? `<p>${escapeHtml(empresaContato)}</p>` : ""}
    </div>
  </div>

  <h1 class="titulo">RECIBO</h1>
  <div class="numero">Nº ${escapeHtml(numero)} • ${escapeHtml(template?.nome || "")}</div>

  <div class="valor-box">
    <div>
      <div class="label">Valor</div>
      <div class="valor">${escapeHtml(fmtBRL(valor))}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Data de emissão</div>
      <div class="valor" style="font-size:14px; padding-top:8px">${escapeHtml(dataEmissao)}</div>
    </div>
  </div>

  <p class="corpo">
    Recebi(emos) de <strong>${escapeHtml(cliente?.nome || "")}</strong>${cliente?.cpf_cnpj ? `, inscrito(a) no CPF/CNPJ <strong>${escapeHtml(cliente.cpf_cnpj)}</strong>,` : ""}
    a importância de <strong>${escapeHtml(fmtBRL(valor))}</strong>${descricao ? `, referente a <strong>${escapeHtml(descricao)}</strong>` : ""}.
    Para clareza firmo(amos) o presente recibo, dando plena, geral e irrevogável quitação do valor recebido.
  </p>

  ${
    extraRows
      ? `<table class="dados"><tbody>${extraRows}</tbody></table>`
      : ""
  }

  <div class="assinatura">
    <div class="linha"></div>
    <div class="nome">${escapeHtml(empresaNome)}</div>
    ${empresaCnpj ? `<div style="font-size:10px;color:#555">CNPJ ${escapeHtml(empresaCnpj)}</div>` : ""}
  </div>

  <div class="footer">
    Documento gerado eletronicamente em ${escapeHtml(new Date().toLocaleString("pt-BR"))} • Recibo ${escapeHtml(numero)}
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
      .from("recibos_emitidos")
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
