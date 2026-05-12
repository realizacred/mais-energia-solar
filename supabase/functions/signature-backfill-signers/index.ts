/**
 * Backfill de document_signers para documentos já enviados sem rastreamento.
 * Autentique: busca signatures por envelope_id e popula a tabela canônica.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchAutentiqueSignatures(envelopeId: string, apiToken: string) {
  const query = `query GetDocumentSignatures($id: UUID!) { document(id: $id) { signatures { public_id name email viewed { created_at } signed { created_at } } } }`;
  const res = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: envelopeId } }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data?.errors?.length) {
    throw new Error(data?.errors?.[0]?.message || `Autentique HTTP ${res.status}`);
  }
  return Array.isArray(data?.data?.document?.signatures) ? data.data.document.signatures : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Não autorizado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authErr } = await caller.auth.getUser();
    if (authErr || !user) return json(401, { error: "Sessão inválida" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id || !profile.ativo) return json(403, { error: "Usuário inativo ou sem tenant" });

    const body = await req.json().catch(() => ({}));
    const documentId = typeof body?.document_id === "string" ? body.document_id : null;
    const limit = Math.min(Math.max(Number(body?.limit ?? 25), 1), 50);

    let docsQuery = admin
      .from("generated_documents")
      .select("id, tenant_id, envelope_id, signature_provider, signature_status, created_at")
      .eq("tenant_id", profile.tenant_id)
      .in("signature_status", ["sent", "viewed", "partially_signed"])
      .not("envelope_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (documentId) docsQuery = docsQuery.eq("id", documentId);

    const { data: docs, error: docsErr } = await docsQuery;
    if (docsErr) return json(500, { error: docsErr.message });
    if (!docs?.length) return json(200, { success: true, processed: 0, inserted: 0 });

    const docIds = docs.map((d: any) => d.id);
    const { data: existing, error: existingErr } = await admin
      .from("document_signers")
      .select("document_id")
      .in("document_id", docIds);
    if (existingErr) return json(500, { error: existingErr.message });
    const existingIds = new Set((existing ?? []).map((s: any) => s.document_id));
    const pendingDocs = docs.filter((d: any) => !existingIds.has(d.id));

    const { data: settings } = await admin
      .from("signature_settings")
      .select("api_token_encrypted, provider")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!settings?.api_token_encrypted) return json(400, { error: "Token Autentique não configurado" });

    let inserted = 0;
    const failures: Array<{ document_id: string; error: string }> = [];

    for (const doc of pendingDocs as any[]) {
      if (doc.signature_provider !== "autentique") {
        failures.push({ document_id: doc.id, error: `Provedor não suportado no backfill: ${doc.signature_provider}` });
        continue;
      }

      try {
        const signatures = await fetchAutentiqueSignatures(doc.envelope_id, settings.api_token_encrypted);
        const rows = signatures.map((sig: any, idx: number) => {
          const signedAt = sig?.signed?.created_at ?? null;
          const viewedAt = sig?.viewed?.created_at ?? null;
          return {
            tenant_id: doc.tenant_id,
            document_id: doc.id,
            provider_signer_id: sig?.public_id ?? null,
            name: sig?.name || sig?.email || "Signatário",
            email: sig?.email ?? null,
            role: idx === 0 ? "Contratante" : "Contratada",
            order_index: idx,
            status: signedAt ? "signed" : viewedAt ? "viewed" : "pending",
            viewed_at: viewedAt,
            signed_at: signedAt,
          };
        });

        if (rows.length > 0) {
          const { error: signersErr } = await admin.from("document_signers").insert(rows);
          if (signersErr) throw signersErr;
          inserted += rows.length;
        }
      } catch (err: any) {
        console.error("[signature-backfill-signers] CRÍTICO: falha ao gravar signatários:", err);
        failures.push({ document_id: doc.id, error: err?.message || "Erro desconhecido" });
      }
    }

    return json(200, { success: failures.length === 0, processed: pendingDocs.length, inserted, failures });
  } catch (err: any) {
    console.error("[signature-backfill-signers] Unexpected:", err?.message);
    return json(500, { error: err?.message || "Erro interno" });
  }
});