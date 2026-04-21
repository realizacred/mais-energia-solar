// Edge Function: import-file-from-url
// Downloads a file from an external URL, validates, hashes, deduplicates, and stores it
// in the 'imported-files' bucket. Returns a canonical imported_files record.
// RB-14: never call external APIs from frontend — this is the canonical entry point.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const DOWNLOAD_TIMEOUT_MS = 30_000;

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/octet-stream": "bin",
};

function extFromMime(mime: string | null, fallbackName?: string | null): string {
  if (mime && EXT_BY_MIME[mime.toLowerCase()]) return EXT_BY_MIME[mime.toLowerCase()];
  if (fallbackName) {
    const m = fallbackName.match(/\.([a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
  }
  return "bin";
}

function isUrlSafe(url: URL): boolean {
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) return false;
  // Block private IPv4 ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  return true;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ImportRequest {
  tenant_id: string;
  source_system: string;
  source_url: string;
  source_record_id?: string;
  entity_type?: string;
  entity_id?: string;
  category?: string;
  original_file_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as ImportRequest;
    const {
      tenant_id,
      source_system,
      source_url,
      source_record_id,
      entity_type,
      entity_id,
      category,
      original_file_name,
    } = body;

    if (!tenant_id || !source_system || !source_url) {
      return new Response(
        JSON.stringify({ error: "tenant_id, source_system e source_url são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Validate URL (SSRF protection)
    let url: URL;
    try {
      url = new URL(source_url);
    } catch {
      return new Response(
        JSON.stringify({ error: "URL inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!isUrlSafe(url)) {
      return new Response(
        JSON.stringify({ error: "URL bloqueada por segurança (SSRF)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Check if we already imported this source_url for this tenant (cheap dedup)
    const { data: existingBySource } = await supabase
      .from("imported_files")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("source_url", source_url)
      .eq("status", "success")
      .maybeSingle();

    if (existingBySource) {
      // Link to entity if requested
      if (entity_type && entity_id) {
        await supabase.from("entity_files").upsert({
          tenant_id,
          entity_type,
          entity_id,
          file_id: existingBySource.id,
          category: category ?? null,
        }, { onConflict: "tenant_id,entity_type,entity_id,file_id,category" });
      }
      return new Response(
        JSON.stringify({ ok: true, file: existingBySource, deduped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Download with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(source_url, {
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("imported_files").insert({
        tenant_id, source_system, source_url, source_record_id,
        original_file_name, status: "error",
        error_message: `Download falhou: ${msg}`,
      });
      return new Response(
        JSON.stringify({ ok: false, error: `Download falhou: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timer);

    if (!response.ok) {
      await supabase.from("imported_files").insert({
        tenant_id, source_system, source_url, source_record_id,
        original_file_name, status: "error",
        error_message: `HTTP ${response.status}`,
      });
      return new Response(
        JSON.stringify({ ok: false, error: `HTTP ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader && parseInt(contentLengthHeader) > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ ok: false, error: `Arquivo excede ${MAX_FILE_SIZE} bytes` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      await supabase.from("imported_files").insert({
        tenant_id, source_system, source_url, source_record_id,
        original_file_name, status: "error", error_message: "Arquivo vazio",
      });
      return new Response(
        JSON.stringify({ ok: false, error: "Arquivo vazio" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ ok: false, error: `Arquivo excede ${MAX_FILE_SIZE} bytes` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mimeType = (response.headers.get("content-type") || "application/octet-stream")
      .split(";")[0].trim().toLowerCase();

    // 4) Hash + dedup by hash
    const fileHash = await sha256Hex(buffer);

    const { data: existingByHash } = await supabase
      .from("imported_files")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("file_hash", fileHash)
      .eq("status", "success")
      .maybeSingle();

    if (existingByHash) {
      if (entity_type && entity_id) {
        await supabase.from("entity_files").upsert({
          tenant_id,
          entity_type,
          entity_id,
          file_id: existingByHash.id,
          category: category ?? null,
        }, { onConflict: "tenant_id,entity_type,entity_id,file_id,category" });
      }
      return new Response(
        JSON.stringify({ ok: true, file: existingByHash, deduped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) Upload to storage
    const ext = extFromMime(mimeType, original_file_name);
    const storagePath = `${tenant_id}/${entity_type ?? "generic"}/${fileHash}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("imported-files")
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      await supabase.from("imported_files").insert({
        tenant_id, source_system, source_url, source_record_id,
        original_file_name, mime_type: mimeType, file_size: buffer.byteLength,
        file_hash: fileHash, status: "error",
        error_message: `Upload falhou: ${uploadError.message}`,
      });
      return new Response(
        JSON.stringify({ ok: false, error: `Upload falhou: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) Register canonical row
    const { data: inserted, error: insertError } = await supabase
      .from("imported_files")
      .insert({
        tenant_id,
        source_system,
        source_url,
        source_record_id,
        original_file_name,
        mime_type: mimeType,
        file_size: buffer.byteLength,
        file_hash: fileHash,
        storage_path: storagePath,
        status: "success",
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      return new Response(
        JSON.stringify({ ok: false, error: `Insert falhou: ${insertError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7) Link to entity if provided
    if (entity_type && entity_id) {
      await supabase.from("entity_files").upsert({
        tenant_id,
        entity_type,
        entity_id,
        file_id: inserted.id,
        category: category ?? null,
      }, { onConflict: "tenant_id,entity_type,entity_id,file_id,category" });
    }

    return new Response(
      JSON.stringify({ ok: true, file: inserted, deduped: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[import-file-from-url] Error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
