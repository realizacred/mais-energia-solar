/**
 * Edge Function: signature-resend
 * Reenvia o e-mail/notificação de assinatura para um signatário pendente.
 *
 * Body: { signer_id: string }
 *
 * RB-23: console.error only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resendAutentique(envelopeId: string, providerSignerId: string, apiToken: string) {
  const query = `mutation ResendSignatures($public_ids: [UUID!]!) { resendSignatures(public_ids: $public_ids) }`;
  const res = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { public_ids: [providerSignerId] } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.errors?.length) {
    throw new Error(data?.errors?.[0]?.message || `Autentique resend HTTP ${res.status}`);
  }
}

async function resendZapSign(envelopeId: string, _providerSignerId: string, signerEmail: string, apiToken: string) {
  // ZapSign exposes a per-document notify endpoint by signer email
  const res = await fetch(`https://api.zapsign.com.br/api/v1/docs/${envelopeId}/resend-email/`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: signerEmail }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`ZapSign resend HTTP ${res.status}: ${txt}`);
  }
}

async function resendClickSign(envelopeId: string, providerSignerId: string, apiToken: string, sandbox: boolean) {
  // Clicksign: notification by request_signature_key (here we use providerSignerId as the list key)
  const base = sandbox ? "https://sandbox.clicksign.com" : "https://app.clicksign.com";
  const res = await fetch(`${base}/api/v2/notifications?access_token=${apiToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notification: { list_key: providerSignerId, message: "Lembrete: assine o documento." } }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Clicksign resend HTTP ${res.status}: ${txt}`);
  }
}

async function resendAssinafy(envelopeId: string, providerSignerId: string, apiToken: string, sandbox: boolean) {
  const idx = apiToken.indexOf(":");
  const apiKey = idx > 0 ? apiToken.slice(idx + 1).trim() : apiToken;
  const base = sandbox ? "https://sandbox.assinafy.com.br/v1" : "https://api.assinafy.com.br/v1";
  // Assinafy needs the assignmentId; we look up the document and grab the active assignment.
  const docRes = await fetch(`${base}/documents/${envelopeId}`, { headers: { "X-Api-Key": apiKey } });
  const docJson = await docRes.json().catch(() => ({} as any));
  const assignmentId = docJson?.data?.assignment?.id || docJson?.assignment?.id;
  if (!assignmentId) throw new Error("Assinafy: assignment ID não encontrado.");
  const res = await fetch(
    `${base}/documents/${envelopeId}/assignments/${assignmentId}/signers/${providerSignerId}/resend`,
    { method: "PUT", headers: { "X-Api-Key": apiKey } },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Assinafy resend HTTP ${res.status}: ${txt}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autorizado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) return json(401, { error: "Sessão inválida" });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const { signer_id } = body || {};
    if (!signer_id) return json(400, { error: "signer_id obrigatório" });

    const { data: signer, error: sErr } = await supabase
      .from("document_signers")
      .select("id, tenant_id, document_id, provider_signer_id, email, status")
      .eq("id", signer_id)
      .maybeSingle();
    if (sErr || !signer) return json(404, { error: "Signatário não encontrado" });
    if (signer.status === "signed") return json(400, { error: "Signatário já assinou" });

    const { data: doc } = await supabase
      .from("generated_documents")
      .select("envelope_id, signature_provider, tenant_id")
      .eq("id", signer.document_id)
      .maybeSingle();
    if (!doc?.envelope_id || !doc.signature_provider) return json(400, { error: "Documento sem provedor configurado" });

    const { data: settings } = await supabase
      .from("signature_settings")
      .select("api_token_encrypted, sandbox_mode")
      .eq("tenant_id", doc.tenant_id)
      .maybeSingle();
    if (!settings?.api_token_encrypted) return json(400, { error: "Token do provedor não configurado" });

    try {
      if (doc.signature_provider === "autentique") {
        if (!signer.provider_signer_id) throw new Error("provider_signer_id ausente para Autentique");
        await resendAutentique(doc.envelope_id, signer.provider_signer_id, settings.api_token_encrypted);
      } else if (doc.signature_provider === "zapsign") {
        if (!signer.email) throw new Error("Signatário sem e-mail");
        await resendZapSign(doc.envelope_id, signer.provider_signer_id || "", signer.email, settings.api_token_encrypted);
      } else if (doc.signature_provider === "clicksign") {
        if (!signer.provider_signer_id) throw new Error("provider_signer_id (list_key) ausente para Clicksign");
        await resendClickSign(doc.envelope_id, signer.provider_signer_id, settings.api_token_encrypted, !!settings.sandbox_mode);
      } else if (doc.signature_provider === "assinafy") {
        if (!signer.provider_signer_id) throw new Error("provider_signer_id ausente para Assinafy");
        await resendAssinafy(doc.envelope_id, signer.provider_signer_id, settings.api_token_encrypted, !!settings.sandbox_mode);
      } else {
        return json(400, { error: `Provedor não suportado: ${doc.signature_provider}` });
      }
    } catch (err: any) {
      console.error("[signature-resend] Provider error:", err?.message);
      return json(400, { error: err?.message || "Falha ao reenviar" });
    }

    await supabase
      .from("document_signers")
      .update({ last_resent_at: new Date().toISOString() })
      .eq("id", signer.id);

    return json(200, { success: true });
  } catch (err: any) {
    console.error("[signature-resend] Unexpected:", err?.message);
    return json(500, { error: err?.message || "Erro interno" });
  }
});
