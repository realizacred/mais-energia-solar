/**
 * proposal-public-action
 * 
 * Public endpoint for accepting/rejecting proposals via token.
 * Does NOT require JWT — authenticates via proposta_aceite_tokens.
 * Delegates to the same business logic as proposal-transition.
 * 
 * RB-47: Public accept/reject MUST go through this function, never direct UPDATE.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";

// ─────────────────────────────────────────────────────────
// Termo de Aceite — HTML + PDF (Gotenberg Chromium)
// ─────────────────────────────────────────────────────────
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function fmtBRL(n: unknown): string {
  const num = Number(n ?? 0);
  if (!isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDateTimeBR(iso: string): string {
  try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }); }
  catch { return iso; }
}
async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  } catch { return null; }
}

function buildTermoHtml(ctx: {
  empresaNome: string; empresaLogoDataUrl: string | null;
  clienteNome: string; clienteDoc: string;
  propostaCodigo: string; propostaTitulo: string; valorTotal: number | null;
  consultorNome: string; consultorTelefone: string;
  aceiteData: string; aceiteIp: string; aceiteUserAgent: string;
  snapshotHash: string; payloadHash: string;
  signatureDataUrl: string | null; observacoes: string;
}): string {
  const logoBlock = ctx.empresaLogoDataUrl
    ? `<img src="${ctx.empresaLogoDataUrl}" alt="logo" style="max-height:60px;max-width:200px;" />`
    : `<div style="font-size:18px;font-weight:bold;">${escapeHtml(ctx.empresaNome)}</div>`;
  const sigBlock = ctx.signatureDataUrl
    ? `<img src="${ctx.signatureDataUrl}" alt="assinatura" style="max-height:120px;max-width:380px;border-bottom:1px solid #333;" />`
    : `<div style="height:120px;border-bottom:1px solid #333;"></div>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>Termo de Aceite</title>
<style>
  @page { size: A4; margin: 24mm 20mm; }
  body { font-family: Arial, Helvetica, sans-serif; color:#222; font-size:12px; line-height:1.5; }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:24px; }
  .header .right { text-align:right; font-size:11px; color:#555; }
  h1 { font-size:18px; margin:0 0 16px 0; text-transform:uppercase; letter-spacing:1px; }
  h2 { font-size:13px; margin:20px 0 8px 0; border-bottom:1px solid #ddd; padding-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; }
  td { padding:6px 4px; vertical-align:top; }
  td.label { width:35%; color:#555; font-weight:bold; }
  .box { background:#f8f8f8; border:1px solid #e2e2e2; padding:12px; margin:12px 0; }
  .signature-area { margin-top:36px; }
  .signature-area .line { margin-top:8px; font-size:11px; color:#555; }
  .hash { font-family: 'Courier New', monospace; font-size:9px; word-break:break-all; color:#444; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #ccc; font-size:10px; color:#666; text-align:center; }
  .stamp { display:inline-block; padding:4px 10px; background:#0f5132; color:#fff; font-weight:bold; border-radius:3px; font-size:11px; letter-spacing:0.5px; }
</style></head><body>
  <div class="header">
    <div>${logoBlock}</div>
    <div class="right">
      <div><strong>${escapeHtml(ctx.empresaNome)}</strong></div>
      <div>Termo Nº ${escapeHtml(ctx.propostaCodigo)}</div>
      <div>${escapeHtml(fmtDateTimeBR(ctx.aceiteData))}</div>
    </div>
  </div>
  <h1>Termo de Aceite de Proposta Comercial</h1>
  <p>Pelo presente instrumento, o(a) cliente abaixo identificado(a) declara
  ter recebido, lido, compreendido e <strong>ACEITO</strong> integralmente os
  termos, condições, escopo técnico e valores constantes na proposta comercial
  abaixo discriminada, formalizando sua manifestação de vontade por meio de
  assinatura eletrônica.</p>
  <h2>Dados do Cliente</h2>
  <table>
    <tr><td class="label">Nome / Razão Social</td><td>${escapeHtml(ctx.clienteNome)}</td></tr>
    <tr><td class="label">CPF / CNPJ</td><td>${escapeHtml(ctx.clienteDoc || "—")}</td></tr>
  </table>
  <h2>Dados da Proposta</h2>
  <table>
    <tr><td class="label">Código</td><td>${escapeHtml(ctx.propostaCodigo)}</td></tr>
    <tr><td class="label">Título</td><td>${escapeHtml(ctx.propostaTitulo)}</td></tr>
    <tr><td class="label">Valor Total</td><td><strong>${escapeHtml(fmtBRL(ctx.valorTotal))}</strong></td></tr>
    <tr><td class="label">Consultor Responsável</td><td>${escapeHtml(ctx.consultorNome)}${ctx.consultorTelefone ? " — " + escapeHtml(ctx.consultorTelefone) : ""}</td></tr>
  </table>
  ${ctx.observacoes ? `<h2>Observações do Cliente</h2><div class="box">${escapeHtml(ctx.observacoes)}</div>` : ""}
  <h2>Aceite e Assinatura Eletrônica</h2>
  <div class="signature-area">
    ${sigBlock}
    <div class="line"><strong>${escapeHtml(ctx.clienteNome)}</strong></div>
    <div class="line">Documento: ${escapeHtml(ctx.clienteDoc || "—")}</div>
    <div class="line">Aceito em: ${escapeHtml(fmtDateTimeBR(ctx.aceiteData))} (horário de Brasília)</div>
    <div class="line">IP de origem: ${escapeHtml(ctx.aceiteIp)}</div>
    <div class="line">Dispositivo: ${escapeHtml(ctx.aceiteUserAgent)}</div>
    <div style="margin-top:10px;"><span class="stamp">✓ ACEITO ELETRONICAMENTE</span></div>
  </div>
  <h2>Integridade do Documento (SHA-256)</h2>
  <table>
    <tr><td class="label">Hash do conteúdo da proposta</td><td class="hash">${escapeHtml(ctx.snapshotHash || "—")}</td></tr>
    <tr><td class="label">Hash do aceite</td><td class="hash">${escapeHtml(ctx.payloadHash || "—")}</td></tr>
  </table>
  <div class="footer">
    Este documento possui validade jurídica conforme Lei 14.063/2020 (Assinatura Eletrônica)<br/>
    e MP 2.200-2/2001 (ICP-Brasil). Os hashes acima garantem a integridade do conteúdo aceito.
  </div>
</body></html>`;
}

async function generateTermoAceitePdf(admin: any, params: {
  tenantId: string; tokenId: string; propostaId: string; versaoId: string | null;
  aceiteAt: string; aceiteIp: string; aceiteUserAgent: string;
  snapshotHash: string | null; payloadHash: string | null;
}): Promise<string | null> {
  const [propRes, brandRes, tokRes, versaoRes, tenantRes] = await Promise.all([
    admin.from("propostas_nativas").select("codigo, titulo, cliente_id, lead_id").eq("id", params.propostaId).maybeSingle(),
    admin.from("brand_settings").select("logo_url").eq("tenant_id", params.tenantId).maybeSingle(),
    admin.from("proposta_aceite_tokens").select("aceite_nome, aceite_documento, aceite_observacoes").eq("id", params.tokenId).maybeSingle(),
    params.versaoId
      ? admin.from("proposta_versoes").select("valor_total").eq("id", params.versaoId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("tenants").select("nome").eq("id", params.tenantId).maybeSingle(),
  ]);

  const proposta = propRes.data || {};
  const tokRow = tokRes.data || {};
  const versao = versaoRes.data || {};

  let clienteNome = tokRow.aceite_nome || "";
  let clienteDoc = tokRow.aceite_documento || "";
  if (proposta.cliente_id) {
    const { data: cli } = await admin.from("clientes").select("nome, cpf, cnpj").eq("id", proposta.cliente_id).maybeSingle();
    if (cli) {
      clienteNome = clienteNome || cli.nome || "";
      clienteDoc = clienteDoc || cli.cpf || cli.cnpj || "";
    }
  }

  let consultorNome = "—"; let consultorTelefone = "";
  if (proposta.lead_id) {
    const { data: lead } = await admin.from("leads").select("consultor_id").eq("id", proposta.lead_id).maybeSingle();
    if (lead?.consultor_id) {
      const { data: prof } = await admin.from("profiles").select("display_name, telefone").eq("user_id", lead.consultor_id).maybeSingle();
      if (prof) {
        consultorNome = prof.display_name || consultorNome;
        consultorTelefone = prof.telefone || "";
      }
    }
  }

  let logoDataUrl: string | null = null;
  if (brandRes.data?.logo_url) {
    const b64 = await fetchAsBase64(brandRes.data.logo_url);
    if (b64) logoDataUrl = `data:image/png;base64,${b64}`;
  }

  let signatureDataUrl: string | null = null;
  try {
    const { data: sigBlob } = await admin.storage.from("proposal-signatures").download(`${params.tokenId}/assinatura.png`);
    if (sigBlob) {
      const buf = new Uint8Array(await sigBlob.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      signatureDataUrl = `data:image/png;base64,${btoa(bin)}`;
    }
  } catch { /* no signature */ }

  const html = buildTermoHtml({
    empresaNome: tenantRes.data?.nome || "Empresa",
    empresaLogoDataUrl: logoDataUrl,
    clienteNome: clienteNome || "Cliente",
    clienteDoc,
    propostaCodigo: proposta.codigo || params.propostaId.slice(0, 8),
    propostaTitulo: proposta.titulo || "Proposta Comercial",
    valorTotal: versao.valor_total ?? null,
    consultorNome, consultorTelefone,
    aceiteData: params.aceiteAt,
    aceiteIp: params.aceiteIp,
    aceiteUserAgent: params.aceiteUserAgent,
    snapshotHash: params.snapshotHash || "",
    payloadHash: params.payloadHash || "",
    signatureDataUrl,
    observacoes: tokRow.aceite_observacoes || "",
  });

  const gotenbergUrl = await resolveGotenbergUrl(admin, params.tenantId);
  const fd = new FormData();
  fd.append("files", new Blob([html], { type: "text/html" }), "index.html");
  fd.append("paperWidth", "8.27");
  fd.append("paperHeight", "11.7");
  fd.append("marginTop", "0.4");
  fd.append("marginBottom", "0.4");
  fd.append("marginLeft", "0.4");
  fd.append("marginRight", "0.4");
  fd.append("printBackground", "true");

  const resp = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, { method: "POST", body: fd });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Gotenberg ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const pdfBytes = new Uint8Array(await resp.arrayBuffer());

  const path = `${params.tenantId}/termos/${params.tokenId}/termo-aceite.pdf`;
  const { error: upErr } = await admin.storage.from("proposta-documentos")
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  const { data: signed } = await admin.storage.from("proposta-documentos")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  return signed?.signedUrl || null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SHA-256 helper (Web Crypto)
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
const VALID_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["gerada"],
  gerada: ["enviada", "aceita", "recusada", "cancelada"],
  enviada: ["vista", "aceita", "recusada", "cancelada"],
  vista: ["aceita", "recusada", "cancelada"],
  aceita: ["cancelada"],
  recusada: ["gerada", "enviada"],
  expirada: ["gerada"],
  cancelada: [],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token, action, motivo, user_agent } = body;

    // Resolve real IP from request headers (RB: never trust client-sent IP)
    const xff = req.headers.get("x-forwarded-for");
    const realIp = xff ? xff.split(",")[0].trim() : (req.headers.get("x-real-ip") || "unknown");
    const ip_address = realIp;

    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: "token e action são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["aceitar", "recusar"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action deve ser 'aceitar' ou 'recusar'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Validate token
    const { data: tokenData, error: tokenErr } = await admin
      .from("proposta_aceite_tokens")
      .select("id, proposta_id, versao_id, tenant_id, tipo, expires_at, invalidado_em, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.invalidado_em) {
      return new Response(
        JSON.stringify({ error: "Token já foi invalidado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const propostaId = tokenData.proposta_id;
    const tenantId = tokenData.tenant_id;
    const newStatus = action === "aceitar" ? "aceita" : "recusada";

    // 2. Load current proposal
    const { data: proposta, error: pErr } = await admin
      .from("propostas_nativas")
      .select("id, status, lead_id, cliente_id, projeto_id, tenant_id")
      .eq("id", propostaId)
      .eq("tenant_id", tenantId)
      .single();

    if (pErr || !proposta) {
      return new Response(
        JSON.stringify({ error: "Proposta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate transition
    const currentStatus = proposta.status || "rascunho";
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return new Response(
        JSON.stringify({
          error: `Transição inválida: ${currentStatus} → ${newStatus}`,
          allowed,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3b. Idempotency check
    const { data: existingEvent } = await admin
      .from("proposal_events")
      .select("id")
      .eq("proposta_id", propostaId)
      .eq("tipo", newStatus === "aceita" ? "proposta_aceita" : "proposta_recusada")
      .maybeSingle();

    if (existingEvent) {
      return new Response(
        JSON.stringify({
          success: true,
          idempotent: true,
          message: `Ação '${action}' já registrada anteriormente`,
          previous_status: currentStatus,
          new_status: newStatus,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build update payload
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "aceita") {
      updateData.aceita_at = now;
      updateData.is_principal = true;
    }
    if (newStatus === "recusada") {
      updateData.recusada_at = now;
      updateData.recusa_motivo = motivo || null;
    }
    // Clear opposite timestamps
    if (newStatus !== "aceita") {
      updateData.aceita_at = null;
      updateData.aceite_motivo = null;
    }
    if (newStatus !== "recusada") {
      updateData.recusada_at = null;
      updateData.recusa_motivo = null;
    }

    // 5. Execute update
    const { error: updateErr } = await admin
      .from("propostas_nativas")
      .update(updateData)
      .eq("id", propostaId);

    if (updateErr) throw updateErr;

    // 5a. Sync proposta_versoes.status
    try {
      const statusMap: Record<string, string> = {
        aceita: "accepted",
        recusada: "rejected",
      };
      const { data: latestVersao } = await admin
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", propostaId)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersao?.id) {
        await admin
          .from("proposta_versoes")
          .update({ status: statusMap[newStatus] || newStatus })
          .eq("id", latestVersao.id);
      }
    } catch (syncErr) {
      console.error("[proposal-public-action] Erro ao sincronizar versão:", syncErr);
    }

    // 5b. On accept: reject siblings + cancel generated documents
    if (newStatus === "aceita" && proposta.projeto_id) {
      // Clear is_principal on siblings
      await admin
        .from("propostas_nativas")
        .update({ is_principal: false })
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", propostaId);

      // Reject actionable siblings
      const { data: siblings } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("projeto_id", proposta.projeto_id)
        .neq("id", propostaId)
        .in("status", ["gerada", "enviada", "vista", "rascunho"]);

      if (siblings && siblings.length > 0) {
        await admin
          .from("propostas_nativas")
          .update({
            status: "recusada",
            recusada_at: now,
            recusa_motivo: "Outra proposta do projeto foi aceita (aceite público)",
          })
          .in("id", siblings.map((s: any) => s.id));
      }

      // Cancel generated documents (RB-44: never cancel signed)
      try {
        await admin
          .from("generated_documents")
          .update({
            status: "cancelled",
            observacao: "Nova proposta aceita (aceite público)",
            updated_at: now,
          })
          .eq("deal_id", proposta.projeto_id)
          .eq("status", "generated")
          .neq("signature_status", "signed");
      } catch (docErr) {
        console.error("[proposal-public-action] Erro ao cancelar documentos:", docErr);
      }

      // Generate commission (same logic as proposal-transition)
      try {
        const { data: existingComm } = await admin
          .from("comissoes")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("projeto_id", proposta.projeto_id)
          .neq("status", "cancelada")
          .maybeSingle();

        if (!existingComm && proposta.lead_id) {
          const { data: versao } = await admin
            .from("proposta_versoes")
            .select("potencia_kwp, valor_total")
            .eq("proposta_id", propostaId)
            .order("versao_numero", { ascending: false })
            .limit(1)
            .maybeSingle();

          const valorTotal = versao?.valor_total || 0;
          const potenciaKwp = versao?.potencia_kwp || 0;

          if (valorTotal > 0) {
            const { data: lead } = await admin
              .from("leads")
              .select("consultor_id")
              .eq("id", proposta.lead_id)
              .maybeSingle();

            if (lead?.consultor_id) {
              const { data: plan } = await admin
                .from("commission_plans")
                .select("parameters")
                .eq("tenant_id", tenantId)
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();

              const percentual = (plan?.parameters as any)?.percentual ?? 5;

              let clienteNome = "Cliente";
              if (proposta.cliente_id) {
                const { data: cl } = await admin
                  .from("clientes")
                  .select("nome")
                  .eq("id", proposta.cliente_id)
                  .maybeSingle();
                clienteNome = cl?.nome || clienteNome;
              }

              await admin.from("comissoes").insert({
                tenant_id: tenantId,
                consultor_id: lead.consultor_id,
                cliente_id: proposta.cliente_id,
                projeto_id: proposta.projeto_id,
                descricao: `Proposta aceita (público) - ${clienteNome} (${potenciaKwp}kWp)`,
                valor_base: valorTotal,
                percentual_comissao: percentual,
                valor_comissao: (valorTotal * percentual) / 100,
                mes_referencia: new Date().getMonth() + 1,
                ano_referencia: new Date().getFullYear(),
                status: "pendente",
              });
            }
          }
        }
      } catch (commErr) {
        console.error("[proposal-public-action] Erro ao gerar comissão:", commErr);
      }
    }

    // 6. Cancel commissions on reject
    if (newStatus === "recusada" && proposta.projeto_id) {
      await admin
        .from("comissoes")
        .update({ status: "cancelada", observacoes: `Proposta recusada (público)` })
        .eq("projeto_id", proposta.projeto_id)
        .eq("status", "pendente");
    }

    // 7. Compute integrity hashes (only on accept) and persist token state
    let snapshotHash: string | null = null;
    let aceitePayloadHash: string | null = null;

    if (newStatus === "aceita") {
      try {
        const [{ data: versaoRow }, { data: tokRow }] = await Promise.all([
          admin.from("proposta_versoes").select("snapshot").eq("id", tokenData.versao_id).maybeSingle(),
          admin.from("proposta_aceite_tokens").select("aceite_nome, aceite_documento").eq("id", tokenData.id).maybeSingle(),
        ]);
        if (versaoRow?.snapshot) {
          snapshotHash = await sha256Hex(JSON.stringify(versaoRow.snapshot));
        }
        const nome = (tokRow?.aceite_nome ?? "").toString();
        const doc = (tokRow?.aceite_documento ?? "").toString();
        aceitePayloadHash = await sha256Hex(`${nome}|${doc}|${now}|${snapshotHash ?? ""}`);
      } catch (hashErr) {
        console.error("[proposal-public-action] Hash error:", hashErr);
      }
    }

    await admin
      .from("proposta_aceite_tokens")
      .update({
        used_at: now,
        aceite_ip: ip_address || null,
        aceite_user_agent: user_agent || null,
        snapshot_hash: snapshotHash,
        aceite_payload_hash: aceitePayloadHash,
      })
      .eq("id", tokenData.id);

    // 7b. Generate Termo de Aceite PDF (non-blocking)
    if (newStatus === "aceita") {
      try {
        const pdfUrl = await generateTermoAceitePdf(admin, {
          tenantId,
          tokenId: tokenData.id,
          propostaId,
          versaoId: tokenData.versao_id,
          aceiteAt: now,
          aceiteIp: ip_address || "unknown",
          aceiteUserAgent: user_agent || "unknown",
          snapshotHash,
          payloadHash: aceitePayloadHash,
        });
        if (pdfUrl) {
          await admin
            .from("proposta_aceite_tokens")
            .update({ termo_aceite_pdf_url: pdfUrl })
            .eq("id", tokenData.id);

          // 7c. Enviar termo ao cliente via WhatsApp (non-blocking)
          try {
            const { data: prop } = await admin
              .from("propostas_nativas")
              .select("cliente_id")
              .eq("id", propostaId)
              .maybeSingle();
            const clienteId = prop?.cliente_id;
            if (clienteId) {
              const { data: cli } = await admin
                .from("clientes")
                .select("nome, telefone")
                .eq("id", clienteId)
                .maybeSingle();
              const rawPhone = (cli?.telefone || "").replace(/\D/g, "");
              if (rawPhone && rawPhone.length >= 10) {
                const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
                const remoteJid = `${phone}@s.whatsapp.net`;
                const { data: waInstance } = await admin
                  .from("wa_instances")
                  .select("id")
                  .eq("tenant_id", tenantId)
                  .eq("status", "connected")
                  .limit(1)
                  .maybeSingle();
                if (waInstance?.id) {
                  const primeiroNome = (cli?.nome || "").split(" ")[0] || "cliente";
                  const mensagem =
                    `Olá ${primeiroNome}! 🎉 Recebemos seu aceite da proposta solar.\n\n` +
                    `Segue seu comprovante de aceite:\n${pdfUrl}\n\n` +
                    `Em breve nossa equipe entrará em contato. Obrigado pela confiança!`;
                  const { error: enqErr } = await admin.rpc("enqueue_wa_outbox_item", {
                    p_tenant_id: tenantId,
                    p_instance_id: waInstance.id,
                    p_remote_jid: remoteJid,
                    p_message_type: "text",
                    p_content: mensagem,
                    p_idempotency_key: `termo-aceite-${tokenData.id}`,
                  });
                  if (enqErr) {
                    console.warn("[proposal-public-action] WA termo enqueue falhou:", enqErr.message);
                  }
                }
              }
            }
          } catch (waErr) {
            console.warn("[proposal-public-action] Envio WA termo falhou (non-blocking):", waErr);
          }
        }
      } catch (pdfErr) {
        console.error("[proposal-public-action] Termo PDF error (non-blocking):", pdfErr);
      }
    }

    // 8. Log event
    const eventType = newStatus === "aceita" ? "proposta_aceita" : "proposta_recusada";
    try {
      await admin.from("proposal_events").insert({
        proposta_id: propostaId,
        tipo: eventType,
        payload: {
          previous_status: currentStatus,
          new_status: newStatus,
          motivo: motivo || null,
          source: "public_token",
          ip_address: ip_address || null,
          user_agent: user_agent || null,
        },
        tenant_id: tenantId,
      });
    } catch (evtErr) {
      console.error("[proposal-public-action] Erro ao registrar evento:", evtErr);
    }

    // 9. Trigger notification (fire-and-forget)
    try {
      await admin.functions.invoke("proposal-decision-notify", {
        body: {
          token_id: tokenData.id,
          decisao: newStatus, // "aceita" | "recusada"
        },
      });
    } catch {
      // Non-blocking
    }

    return new Response(
      JSON.stringify({
        success: true,
        previous_status: currentStatus,
        new_status: newStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[proposal-public-action] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
