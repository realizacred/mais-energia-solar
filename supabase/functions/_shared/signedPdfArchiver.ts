/**
 * Fetches the signed PDF from the provider and archives it in Supabase Storage.
 * Bucket: document-files | Path: signed/{tenant_id}/{doc_id}/documento-assinado.pdf
 * RB-23: console.error only.
 */

const BUCKET = "document-files";

interface ArchiveDeps {
  supabase: any;
  doc: { id: string; tenant_id: string; envelope_id: string | null; signature_provider: string | null };
  apiToken: string;
  sandbox: boolean;
}

async function fetchAutentiqueSignedUrl(envelopeId: string, apiToken: string): Promise<string | null> {
  const query = `query GetDocument($id: UUID!) { document(id: $id) { id files { signed original } } }`;
  const res = await fetch("https://api.autentique.com.br/v2/graphql", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: envelopeId } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.document?.files?.signed || null;
}

async function fetchZapSignSignedUrl(envelopeId: string, apiToken: string): Promise<string | null> {
  const res = await fetch(`https://api.zapsign.com.br/api/v1/docs/${envelopeId}/`, {
    headers: { "Authorization": `Bearer ${apiToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.signed_file || data?.original_file || null;
}

async function fetchClickSignSignedUrl(envelopeId: string, apiToken: string, sandbox: boolean): Promise<string | null> {
  const base = sandbox ? "https://sandbox.clicksign.com" : "https://app.clicksign.com";
  const res = await fetch(`${base}/api/v2/documents/${envelopeId}?access_token=${apiToken}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.document?.downloads?.signed_file_url || data?.document?.downloads?.original_file_url || null;
}

async function fetchAssinafySignedUrl(envelopeId: string, apiToken: string, sandbox: boolean): Promise<string | null> {
  // Token is stored as "ACCOUNT_ID:API_KEY"; only the API key is needed for document GET.
  const idx = apiToken.indexOf(":");
  const apiKey = idx > 0 ? apiToken.slice(idx + 1).trim() : apiToken;
  const base = sandbox ? "https://sandbox.assinafy.com.br/v1" : "https://api.assinafy.com.br/v1";
  const res = await fetch(`${base}/documents/${envelopeId}`, {
    headers: { "X-Api-Key": apiKey },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({} as any));
  const doc = json?.data || json;
  const artifacts = doc?.artifacts || {};
  // Prefer the certificated (signed) artifact when available.
  return artifacts.certificated || artifacts.signed || artifacts.original || null;
}

export async function archiveSignedPdf(deps: ArchiveDeps): Promise<{ ok: boolean; reason?: string; path?: string }> {
  const { supabase, doc, apiToken, sandbox } = deps;
  if (!doc.envelope_id || !doc.signature_provider) {
    return { ok: false, reason: "missing envelope_id or provider" };
  }

  let url: string | null = null;
  try {
    if (doc.signature_provider === "autentique") {
      url = await fetchAutentiqueSignedUrl(doc.envelope_id, apiToken);
    } else if (doc.signature_provider === "zapsign") {
      url = await fetchZapSignSignedUrl(doc.envelope_id, apiToken);
    } else if (doc.signature_provider === "clicksign") {
      url = await fetchClickSignSignedUrl(doc.envelope_id, apiToken, sandbox);
    } else {
      return { ok: false, reason: "unknown provider" };
    }
  } catch (err: any) {
    console.error("[signedPdfArchiver] provider fetch error:", err?.message);
    return { ok: false, reason: "provider fetch error" };
  }

  if (!url) {
    return { ok: false, reason: "signed url not available yet" };
  }

  let bytes: Uint8Array;
  try {
    const pdfRes = await fetch(url);
    if (!pdfRes.ok) {
      console.error("[signedPdfArchiver] PDF download HTTP", pdfRes.status);
      return { ok: false, reason: `pdf http ${pdfRes.status}` };
    }
    bytes = new Uint8Array(await pdfRes.arrayBuffer());
  } catch (err: any) {
    console.error("[signedPdfArchiver] PDF download error:", err?.message);
    return { ok: false, reason: "pdf download error" };
  }

  const path = `signed/${doc.tenant_id}/${doc.id}/documento-assinado.pdf`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    console.error("[signedPdfArchiver] storage upload error:", upErr.message);
    return { ok: false, reason: "storage upload error" };
  }

  const { error: updErr } = await supabase
    .from("generated_documents")
    .update({ signed_pdf_path: path, updated_at: new Date().toISOString() })
    .eq("id", doc.id)
    .eq("tenant_id", doc.tenant_id);
  if (updErr) {
    console.error("[signedPdfArchiver] DB update error:", updErr.message);
    return { ok: false, reason: "db update error" };
  }

  return { ok: true, path };
}
