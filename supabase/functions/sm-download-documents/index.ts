/**
 * sm-download-documents
 * Baixa documentos referenciados por URL externa (S3 do SolarMarket) em
 * deal_custom_field_values e os armazena no bucket `projeto-documentos`,
 * trocando a URL externa pelo storage_path.
 *
 * Body: { tenant_id: string, batch?: number, offset?: number }
 * Resposta: { processed, downloaded, skipped, errors, next_offset }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "projeto-documentos";

const FIELD_KEYS = ["cap_identidade", "cap_comprovante_endereco"];

function inferMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "pdf": return "application/pdf";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "heic": return "image/heic";
    default: return "application/octet-stream";
  }
}

function basenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "arquivo";
    return decodeURIComponent(last).replace(/[^\w.\-]+/g, "_");
  } catch {
    return "arquivo";
  }
}

interface FileMeta {
  storage_path: string;
  filename: string;
  mime?: string;
  size?: number | null;
  uploaded_at?: string | null;
  uploaded_by?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body?.tenant_id;
    const batch: number = Math.min(Math.max(Number(body?.batch ?? 10), 1), 25);
    const offset: number = Math.max(Number(body?.offset ?? 0), 0);

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Carrega field_ids dos campos-alvo
    const { data: fieldDefs, error: fdErr } = await sb
      .from("deal_custom_fields")
      .select("id, field_key")
      .eq("tenant_id", tenantId)
      .in("field_key", FIELD_KEYS);
    if (fdErr) throw fdErr;
    const fieldIds = (fieldDefs ?? []).map((f: any) => f.id);
    if (fieldIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0, downloaded: 0, skipped: 0, errors: [], next_offset: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Carrega lote — apenas registros com http no value_text
    const { data: rows, error: rowsErr } = await sb
      .from("deal_custom_field_values")
      .select("deal_id, field_id, value_text")
      .eq("tenant_id", tenantId)
      .in("field_id", fieldIds)
      .ilike("value_text", "%http%")
      .order("deal_id", { ascending: true })
      .range(offset, offset + batch - 1);
    if (rowsErr) throw rowsErr;

    const processed = rows?.length ?? 0;
    let downloaded = 0;
    let skipped = 0;
    const errors: any[] = [];

    for (const row of rows ?? []) {
      try {
        let metas: FileMeta[];
        try {
          const parsed = JSON.parse(row.value_text);
          metas = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          errors.push({ deal_id: row.deal_id, field_id: row.field_id, error: "invalid JSON" });
          continue;
        }

        const updated: FileMeta[] = [];
        let changed = false;

        for (const meta of metas) {
          if (!meta?.storage_path) { updated.push(meta); continue; }
          if (!/^https?:\/\//i.test(meta.storage_path)) {
            updated.push(meta); // já é path do Storage
            continue;
          }
          const url = meta.storage_path;
          const filename = meta.filename || basenameFromUrl(url);
          const mime = inferMime(filename);
          // Path determinístico — extrai field_key reverso pelo field_id
          const fkRow = fieldDefs!.find((f: any) => f.id === row.field_id);
          const fieldKey = fkRow?.field_key ?? "campo";
          const safeName = filename.replace(/[^\w.\-]+/g, "_");
          const path = `${tenantId}/deals/${row.deal_id}/custom-fields/${fieldKey}/${safeName}`;

          // Idempotência: já existe?
          const parent = path.substring(0, path.lastIndexOf("/"));
          const fname = path.substring(path.lastIndexOf("/") + 1);
          const { data: list } = await sb.storage.from(BUCKET).list(parent, { search: fname });
          const exists = (list ?? []).some((f: any) => f.name === fname);

          let fileSize: number | null = meta.size ?? null;

          if (!exists) {
            // Download — não validar Content-Type
            const resp = await fetch(url);
            if (!resp.ok) {
              errors.push({ deal_id: row.deal_id, url, error: `fetch ${resp.status}` });
              updated.push(meta);
              continue;
            }
            const ab = await resp.arrayBuffer();
            fileSize = ab.byteLength;
            const { error: upErr } = await sb.storage.from(BUCKET).upload(path, ab, {
              contentType: mime,
              upsert: true,
            });
            if (upErr) {
              errors.push({ deal_id: row.deal_id, url, error: `upload ${upErr.message}` });
              updated.push(meta);
              continue;
            }
            downloaded++;
          } else {
            skipped++;
          }

          updated.push({
            storage_path: path,
            filename,
            mime,
            size: fileSize,
            uploaded_at: meta.uploaded_at ?? new Date().toISOString(),
            uploaded_by: meta.uploaded_by,
          });
          changed = true;
        }

        if (changed) {
          const { error: updErr } = await sb
            .from("deal_custom_field_values")
            .update({ value_text: JSON.stringify(updated) })
            .eq("deal_id", row.deal_id)
            .eq("field_id", row.field_id);
          if (updErr) errors.push({ deal_id: row.deal_id, error: `update ${updErr.message}` });
        }
      } catch (e: any) {
        errors.push({ deal_id: row.deal_id, error: e?.message || String(e) });
      }
    }

    const next_offset = processed < batch ? null : offset + batch;

    return new Response(JSON.stringify({ processed, downloaded, skipped, errors, next_offset }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
