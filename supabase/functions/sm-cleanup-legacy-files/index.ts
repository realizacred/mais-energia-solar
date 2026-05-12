// One-off cleanup for legacy file custom field records.
// Tasks (idempotent, scoped to tenant 17de8315-...):
// 1) Convert single_object value_text to array_of_objects
// 2) Rewrite external SM URLs that already exist in canonical bucket to canonical path
// 3) Copy files from legacy bucket 'project-documents' -> canonical 'projeto-documentos'
//    under canonical path, then convert array_of_strings to array_of_objects
//
// Not wired in any orchestrator; invoke manually if ever needed again.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TENANT = "17de8315-2e2f-4a79-8751-e5d507d69a41";
const CANONICAL = "projeto-documentos";
const LEGACY = "project-documents";
const FIELD_KEYS = ["cap_identidade", "cap_comprovante_endereco"];

function inferMime(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const report: any = { converted_single: 0, rewrote_external: 0, copied_from_legacy: 0, errors: [] as string[] };

  // Load fields
  const { data: fields } = await sb
    .from("deal_custom_fields")
    .select("id, field_key")
    .in("field_key", FIELD_KEYS)
    .eq("tenant_id", TENANT);
  const fieldIds = (fields || []).map((f: any) => f.id);
  if (!fieldIds.length) {
    return new Response(JSON.stringify({ ok: false, error: "no fields" }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  const { data: rows } = await sb
    .from("deal_custom_field_values")
    .select("id, deal_id, field_id, value_text")
    .in("field_id", fieldIds);

  for (const row of rows || []) {
    if (!row.value_text) continue;
    let parsed: any;
    try { parsed = JSON.parse(row.value_text); } catch { continue; }

    const fieldKey = (fields || []).find((f: any) => f.id === row.field_id)?.field_key;
    let changed = false;
    let arr: any[];

    // single object -> wrap
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.storage_path) {
      arr = [parsed];
      changed = true;
      report.converted_single++;
    } else if (Array.isArray(parsed)) {
      arr = parsed;
    } else {
      continue;
    }

    // Process each entry
    const newArr: any[] = [];
    for (const entry of arr) {
      // string entry -> needs copy from legacy bucket
      if (typeof entry === "string") {
        const legacyPath = entry;
        const filename = legacyPath.split("/").pop() || "arquivo";
        const canonicalPath = `${TENANT}/deals/${row.deal_id}/custom-fields/${fieldKey}/${filename}`;

        // Check if already in canonical
        const { data: existsCanonical } = await sb.storage.from(CANONICAL).list(canonicalPath.substring(0, canonicalPath.lastIndexOf("/")), { search: filename });
        const already = (existsCanonical || []).some((o: any) => o.name === filename);

        if (!already) {
          // Download from legacy
          const { data: blob, error: dErr } = await sb.storage.from(LEGACY).download(legacyPath);
          if (dErr || !blob) {
            report.errors.push(`download legacy ${legacyPath}: ${dErr?.message}`);
            newArr.push(entry);
            continue;
          }
          const mime = inferMime(filename);
          const { error: uErr } = await sb.storage.from(CANONICAL).upload(canonicalPath, blob, { contentType: mime, upsert: false });
          if (uErr && !String(uErr.message).includes("already exists")) {
            report.errors.push(`upload canonical ${canonicalPath}: ${uErr.message}`);
            newArr.push(entry);
            continue;
          }
          report.copied_from_legacy++;
        }

        // Get size
        let size: number | null = null;
        try {
          const { data: meta } = await sb.storage.from(CANONICAL).list(canonicalPath.substring(0, canonicalPath.lastIndexOf("/")), { search: filename });
          size = meta?.[0]?.metadata?.size ?? null;
        } catch { }

        newArr.push({
          storage_path: canonicalPath,
          filename,
          mime: inferMime(filename),
          size,
          uploaded_at: new Date().toISOString(),
        });
        changed = true;
        continue;
      }

      // object with external http URL -> rewrite if canonical equivalent exists
      if (entry && typeof entry === "object" && typeof entry.storage_path === "string" && /^https?:\/\//i.test(entry.storage_path)) {
        const filenameRaw = entry.filename || decodeURIComponent(entry.storage_path.split("/").pop() || "arquivo");
        const filename = filenameRaw.replace(/\s+/g, "_");
        const canonicalPath = `${TENANT}/deals/${row.deal_id}/custom-fields/${fieldKey}/${filename}`;
        const { data: existsCanonical } = await sb.storage.from(CANONICAL).list(canonicalPath.substring(0, canonicalPath.lastIndexOf("/")), { search: filename });
        const already = (existsCanonical || []).some((o: any) => o.name === filename);
        if (already) {
          newArr.push({
            storage_path: canonicalPath,
            filename: entry.filename || filename,
            mime: entry.mime || inferMime(filename),
            size: existsCanonical?.[0]?.metadata?.size ?? entry.size ?? null,
            uploaded_at: entry.uploaded_at || new Date().toISOString(),
          });
          changed = true;
          report.rewrote_external++;
          continue;
        }
        // Cannot find canonical equivalent -> keep entry but warn
        report.errors.push(`external url has no canonical equivalent: ${entry.storage_path}`);
        newArr.push(entry);
        continue;
      }

      newArr.push(entry);
    }

    if (changed) {
      const { error: updErr } = await sb
        .from("deal_custom_field_values")
        .update({ value_text: JSON.stringify(newArr) })
        .eq("id", row.id);
      if (updErr) report.errors.push(`update row ${row.id}: ${updErr.message}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, report }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
