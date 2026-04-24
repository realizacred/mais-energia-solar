/**
 * sm-promote-custom-fields
 *
 * Lê `sm_propostas_raw.payload.variables` (chaves `cap_*`) e promove
 * para `deal_custom_field_values` no projeto canônico (vínculo via
 * projetos.external_id = sm_project_id, deal_id = projetos.deal_id).
 *
 * Para campos do tipo `file` (cap_identidade, cap_comprovante_endereco):
 *   - baixa cada URL externa
 *   - salva no bucket `imported-files` em `sm/{tenant_id}/{deal_id}/{field_key}/{filename}`
 *   - grava JSON array de paths em value_text
 *
 * Para outros tipos: grava o `value` (ou `formattedValue`) direto na coluna correta.
 *
 * Modo: { action: "promote", payload: { batch?: number, offset?: number, dry_run?: boolean } }
 *
 * Governança: RB-23 (sem console.log), RB-57 (sem let global), RB-58 (verifica count em UPDATE).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "imported-files";

// Mapa: chave SM (cap_*) -> field_key canônico (mesmo nome no tenant).
// Apenas chaves explicitamente listadas serão promovidas.
const CAP_FIELD_KEYS = [
  "cap_obs",
  "cap_equipamento",
  "cap_localizacao",
  "cap_wifi",
  "cap_disjuntor",
  "cap_transformador",
  "cap_identidade",
  "cap_comprovante_endereco",
] as const;

interface PromoteResult {
  ok: boolean;
  processed: number;
  upserted: number;
  files_downloaded: number;
  files_skipped: number;
  files_failed: number;
  errors: Array<{ projeto_id?: string; deal_id?: string; error: string }>;
  next_offset: number | null;
  duration_ms: number;
}

function sanitizeFilename(url: string): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").pop() || "file");
    return last.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
  } catch {
    return "file";
  }
}

async function downloadAndStore(
  supabase: ReturnType<typeof createClient>,
  url: string,
  storagePath: string,
): Promise<{ ok: boolean; path: string; reason?: string }> {
  // Skip if already exists.
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list(storagePath.split("/").slice(0, -1).join("/"), {
      search: storagePath.split("/").pop(),
    });
  if (existing && existing.length > 0) {
    return { ok: true, path: storagePath, reason: "already_exists" };
  }

  const resp = await fetch(url);
  if (!resp.ok) {
    return { ok: false, path: storagePath, reason: `http_${resp.status}` };
  }
  const contentType =
    resp.headers.get("content-type") || "application/octet-stream";
  const blob = await resp.blob();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, {
      contentType,
      upsert: false,
    });
  if (upErr && !/exists/i.test(upErr.message)) {
    return { ok: false, path: storagePath, reason: upErr.message };
  }
  return { ok: true, path: storagePath };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "promote";
    const payload = body?.payload ?? {};
    const batch = Math.min(Math.max(Number(payload.batch ?? 25), 1), 100);
    const offset = Math.max(Number(payload.offset ?? 0), 0);
    const dryRun = payload.dry_run === true;

    if (action !== "promote") {
      return new Response(
        JSON.stringify({ ok: false, error: `Unknown action: ${action}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Carrega field_key -> {id, type} para o tenant correto.
    //    Buscamos pelo tenant do primeiro projeto que vamos processar.
    const { data: projetos, error: projErr } = await supabase
      .from("projetos")
      .select("id, deal_id, external_id, tenant_id")
      .eq("external_source", "solarmarket")
      .not("deal_id", "is", null)
      .not("external_id", "is", null)
      .order("external_id", { ascending: true })
      .range(offset, offset + batch - 1);

    if (projErr) throw projErr;
    if (!projetos || projetos.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          processed: 0,
          upserted: 0,
          files_downloaded: 0,
          files_skipped: 0,
          files_failed: 0,
          errors: [],
          next_offset: null,
          duration_ms: Date.now() - startedAt,
        } satisfies PromoteResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = projetos[0].tenant_id as string;

    const { data: fields, error: fieldsErr } = await supabase
      .from("deal_custom_fields")
      .select("id, field_key, field_type, tenant_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("field_key", [...CAP_FIELD_KEYS]);
    if (fieldsErr) throw fieldsErr;

    const fieldMap = new Map<string, { id: string; field_type: string }>();
    for (const f of fields ?? []) {
      fieldMap.set(f.field_key as string, {
        id: f.id as string,
        field_type: f.field_type as string,
      });
    }

    // 2. Carrega todas as variáveis das propostas em uma só query (por sm_project_id).
    const smIds = projetos.map((p) => Number(p.external_id)).filter(Boolean);
    const { data: propostas, error: propErr } = await supabase
      .from("sm_propostas_raw")
      .select("payload")
      .in("payload->>_sm_project_id", smIds.map(String));
    if (propErr) throw propErr;

    // Indexar por sm_project_id (pegar a proposta mais recente de cada projeto).
    const propostasByProj = new Map<string, any>();
    for (const row of propostas ?? []) {
      const p = (row as any).payload;
      const pid = String(p?._sm_project_id ?? p?.project?.id ?? "");
      if (!pid) continue;
      const generatedAt = p?.generatedAt || p?.createdAt || "";
      const existing = propostasByProj.get(pid);
      if (!existing || (existing.generatedAt || "") < generatedAt) {
        propostasByProj.set(pid, p);
      }
    }

    let upserted = 0;
    let filesDownloaded = 0;
    let filesSkipped = 0;
    let filesFailed = 0;
    const errors: Array<{ projeto_id?: string; deal_id?: string; error: string }> = [];

    for (const proj of projetos) {
      const dealId = proj.deal_id as string;
      const projetoId = proj.id as string;
      const sm = propostasByProj.get(String(proj.external_id));
      if (!sm) continue;

      const variables: any[] = Array.isArray(sm?.variables) ? sm.variables : [];

      const rows: Array<Record<string, any>> = [];

      for (const v of variables) {
        const key = v?.key as string | undefined;
        if (!key || !CAP_FIELD_KEYS.includes(key as any)) continue;
        const def = fieldMap.get(key);
        if (!def) continue;
        const rawValue = (v?.value ?? v?.formattedValue ?? "")
          .toString()
          .trim();
        if (!rawValue) continue;

        const baseRow: Record<string, any> = {
          deal_id: dealId,
          field_id: def.id,
          tenant_id: tenantId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_date: null,
        };

        if (def.field_type === "file") {
          // Multiple URLs separated by " | "
          const urls = rawValue
            .split(/\s*\|\s*/)
            .filter((u) => /^https?:\/\//i.test(u));
          if (urls.length === 0) continue;
          const localPaths: string[] = [];
          for (const url of urls) {
            const fname = sanitizeFilename(url);
            const path = `sm/${tenantId}/${dealId}/${key}/${fname}`;
            if (dryRun) {
              localPaths.push(path);
              filesSkipped++;
              continue;
            }
            try {
              const r = await downloadAndStore(supabase, url, path);
              if (r.ok) {
                localPaths.push(r.path);
                if (r.reason === "already_exists") filesSkipped++;
                else filesDownloaded++;
              } else {
                filesFailed++;
                errors.push({
                  projeto_id: projetoId,
                  deal_id: dealId,
                  error: `download ${key}: ${r.reason}`,
                });
              }
            } catch (e) {
              filesFailed++;
              errors.push({
                projeto_id: projetoId,
                deal_id: dealId,
                error: `download ${key}: ${(e as Error).message}`,
              });
            }
          }
          if (localPaths.length === 0) continue;
          baseRow.value_text = JSON.stringify(localPaths);
        } else {
          // text / textarea / select
          baseRow.value_text = rawValue;
        }

        rows.push(baseRow);
      }

      if (rows.length === 0) continue;

      if (!dryRun) {
        const { error: upErr, count } = await supabase
          .from("deal_custom_field_values")
          .upsert(rows, { onConflict: "deal_id,field_id", count: "exact" });
        if (upErr) {
          errors.push({
            projeto_id: projetoId,
            deal_id: dealId,
            error: `upsert: ${upErr.message}`,
          });
        } else {
          upserted += count ?? rows.length;
        }
      } else {
        upserted += rows.length;
      }
    }

    const result: PromoteResult = {
      ok: true,
      processed: projetos.length,
      upserted,
      files_downloaded: filesDownloaded,
      files_skipped: filesSkipped,
      files_failed: filesFailed,
      errors: errors.slice(0, 50),
      next_offset: projetos.length === batch ? offset + batch : null,
      duration_ms: Date.now() - startedAt,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sm-promote-custom-fields] fatal:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (e as Error).message,
        duration_ms: Date.now() - startedAt,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
