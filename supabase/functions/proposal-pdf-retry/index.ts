/**
 * Edge Function: proposal-pdf-retry
 *
 * Conversão manual e idempotente de uma versão de proposta `docx_only`
 * para PDF. Não cria versão nova, não altera status comercial, não toca
 * proposal-generate nem publicProposalResolver. Apenas:
 *
 *   1. Baixa o DOCX já gerado de `proposta_versoes.output_docx_path`
 *   2. Invoca `docx-to-pdf` (mesma engine usada hoje)
 *   3. Faz upload do PDF no bucket `proposta-documentos` (mesmo path do DOCX, .pdf)
 *   4. Atualiza `output_pdf_path`, `generation_status='ready'`,
 *      `generation_error=null`, incrementa `retry_count`
 *
 * Requer um JWT válido e que o usuário seja admin do tenant da versão.
 * Idempotente: se já houver PDF e arquivo existir no storage, retorna ok.
 *
 * Uso (manual, um por vez):
 *   curl -X POST "$URL/functions/v1/proposal-pdf-retry" \
 *     -H "Authorization: Bearer <JWT_DO_ADMIN>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"versao_id":"5aee2ae5-be06-4390-bd28-d701c9dcb1ee"}'
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "proposta-documentos";

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Autenticação via JWT do caller
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonRes({ error: "missing_jwt" }, 401);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return jsonRes({ error: "invalid_jwt" }, 401);
  const userId = userRes.user.id;

  // 2) Payload
  let body: { versao_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonRes({ error: "invalid_json" }, 400);
  }
  const versaoId = body.versao_id;
  if (!versaoId || typeof versaoId !== "string") {
    return jsonRes({ error: "versao_id obrigatório" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // 3) Carrega versão + valida acesso do usuário ao tenant
  const { data: versao, error: vErr } = await admin
    .from("proposta_versoes")
    .select(
      "id, tenant_id, proposta_id, output_docx_path, output_pdf_path, generation_status, generation_error, retry_count",
    )
    .eq("id", versaoId)
    .maybeSingle();
  if (vErr || !versao) return jsonRes({ error: "versao_nao_encontrada" }, 404);

  if (!versao.output_docx_path) {
    return jsonRes(
      { error: "sem_docx_origem", message: "Versão não possui DOCX gerado para reconverter." },
      422,
    );
  }

  // RBAC: usuário precisa ser admin/super_admin do tenant da versão
  const { data: roleRow, error: rErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", versao.tenant_id)
    .in("role", ["admin", "super_admin"] as any)
    .maybeSingle();
  if (rErr || !roleRow) {
    return jsonRes({ error: "forbidden", message: "Requer admin do tenant." }, 403);
  }

  // 4) Idempotência: se já tem PDF e o arquivo existe, retorna ok
  if (versao.output_pdf_path) {
    const parts = versao.output_pdf_path.split("/");
    const filename = parts.pop()!;
    const dir = parts.join("/");
    const { data: list } = await admin.storage.from(BUCKET).list(dir, { search: filename });
    if (list && list.some((f) => f.name === filename)) {
      return jsonRes({
        ok: true,
        already_ready: true,
        versao_id: versaoId,
        pdf_path: versao.output_pdf_path,
      });
    }
  }

  const startedAt = Date.now();

  // 5) Baixa DOCX
  const { data: docxBlob, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(versao.output_docx_path);
  if (dlErr || !docxBlob) {
    return jsonRes({ error: "docx_download_failed", detail: dlErr?.message }, 500);
  }
  const docxBuf = new Uint8Array(await docxBlob.arrayBuffer());
  // base64 encode (chunked para evitar stack overflow em DOCX grande)
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < docxBuf.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, docxBuf.subarray(i, i + CHUNK) as unknown as number[]);
  }
  const docxBase64 = btoa(bin);
  const filename = versao.output_docx_path.split("/").pop() || "proposta.docx";

  // 6) Invoca docx-to-pdf (mesma engine de hoje, com circuit breaker próprio)
  const convResp = await fetch(`${supabaseUrl}/functions/v1/docx-to-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ docxBase64, filename, tenant_id: versao.tenant_id }),
  });

  if (!convResp.ok) {
    const errBody = await convResp.text();
    // Marca o erro mas mantém docx_only — não rebaixa para 'failed' sem necessidade
    await admin
      .from("proposta_versoes")
      .update({
        generation_error: `retry: docx-to-pdf ${convResp.status}: ${errBody.slice(0, 240)}`,
        retry_count: (versao.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", versaoId);
    return jsonRes(
      { ok: false, stage: "gotenberg", status: convResp.status, body: errBody.slice(0, 500) },
      502,
    );
  }

  const pdfBuf = new Uint8Array(await convResp.arrayBuffer());
  if (pdfBuf.byteLength < 1000) {
    return jsonRes({ ok: false, stage: "gotenberg", error: "pdf_too_small" }, 502);
  }

  // 7) Upload PDF no mesmo path do DOCX, trocando extensão
  const pdfPath = versao.output_docx_path.replace(/\.docx$/i, ".pdf");
  const upStart = Date.now();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(pdfPath, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    await admin
      .from("proposta_versoes")
      .update({
        generation_error: `retry: upload failed: ${upErr.message}`,
        retry_count: (versao.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", versaoId);
    return jsonRes({ ok: false, stage: "upload", error: upErr.message }, 500);
  }

  // 8) Atualiza a versão — NÃO mexe em status comercial, snapshot, tokens
  const { error: updErr } = await admin
    .from("proposta_versoes")
    .update({
      output_pdf_path: pdfPath,
      generation_status: "ready",
      generation_error: null,
      retry_count: (versao.retry_count ?? 0) + 1,
      last_retry_at: new Date().toISOString(),
    })
    .eq("id", versaoId);
  if (updErr) {
    return jsonRes({ ok: false, stage: "db_update", error: updErr.message }, 500);
  }

  return jsonRes({
    ok: true,
    versao_id: versaoId,
    pdf_path: pdfPath,
    durations_ms: {
      total: Date.now() - startedAt,
      upload: Date.now() - upStart,
    },
  });
});
