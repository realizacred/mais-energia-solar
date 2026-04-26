/**
 * sm-promote-custom-fields
 *
 * Lê `sm_propostas_raw.payload.variables` (chaves `cap_*`/`capo_*`/`cape_*`)
 * e promove para `deal_custom_field_values` no projeto canônico (vínculo via
 * projetos.external_id = sm_project_id, deal_id = projetos.deal_id).
 *
 * Mapeamento via tabela `sm_custom_field_mapping` (substitui CAP_FIELD_ALIAS_MAP
 * hardcoded). Cada tenant configura via UI (Step 2 da Migração SolarMarket →
 * aba Custom Fields). Ações suportadas:
 *   - 'map'        : usa crm_field_id existente
 *   - 'create_new' : crm_field_id já preenchido pelo eager insert da UI
 *   - 'ignore'     : pula o slug (warning leve, não erro)
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

interface MappingEntry {
  sm_field_key: string;
  action: "map" | "create_new" | "ignore" | "map_native";
  crm_field_id: string | null;
  crm_field_type: string | null; // só preenchido em create_new
  crm_native_target: string | null; // só preenchido em map_native
}

interface MappingResolved {
  /** sm_field_key → { crm_field_id, field_type } para entradas mapeáveis (map + create_new) */
  resolvable: Map<string, { id: string; field_type: string }>;
  /** sm_field_key → caminho whitelisted no snapshot da proposta (action=map_native) */
  nativeTargets: Map<string, string>;
  /** sm_field_key list para entradas com action='ignore' */
  ignored: Set<string>;
  /** sm_field_keys conhecidos (qualquer action) */
  known: Set<string>;
}

/**
 * Whitelist obrigatória — DEVE espelhar a constraint
 * `sm_cfm_native_target_whitelist` em sm_custom_field_mapping.
 * Mudanças aqui exigem migration correspondente.
 */
const NATIVE_TARGET_WHITELIST = new Set<string>([
  "snapshot.tipo_telhado",
  "snapshot.garantias.modulo_sm",
  "snapshot.garantias.inversor_sm",
  "snapshot.garantias.microinversor_sm",
]);

/** Converte "snapshot.garantias.modulo_sm" → ["garantias","modulo_sm"]. */
function nativePathToSnapshotKeys(path: string): string[] | null {
  if (!path.startsWith("snapshot.")) return null;
  const tail = path.slice("snapshot.".length);
  if (!tail) return null;
  return tail.split(".");
}

interface PromoteResult {
  ok: boolean;
  processed: number;
  upserted: number;
  files_downloaded: number;
  files_skipped: number;
  files_failed: number;
  native_updates: number;
  errors: Array<{ projeto_id?: string; deal_id?: string; error: string }>;
  warnings: Array<{ projeto_id?: string; deal_id?: string; warning: string }>;
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
  supabase: any,
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

/**
 * Carrega o mapeamento do tenant a partir de sm_custom_field_mapping
 * e resolve os field_types lendo deal_custom_fields (uma query).
 *
 * Retorna também os slugs SM presentes no staging que NÃO estão na tabela
 * de mapeamento (estes bloqueiam a promoção até o usuário configurá-los).
 */
async function loadFieldMapping(
  supabase: any,
  tenantId: string,
): Promise<{
  resolved: MappingResolved;
  unmapped: string[];
  invalid: Array<{ sm_field_key: string; reason: string }>;
}> {
  // 1. Mapeamentos configurados
  const { data: mappings, error: mErr } = await supabase
    .from("sm_custom_field_mapping")
    .select("sm_field_key, action, crm_field_id, crm_field_type, crm_native_target")
    .eq("tenant_id", tenantId);
  if (mErr) throw mErr;

  const entries: MappingEntry[] = (mappings ?? []) as MappingEntry[];
  const known = new Set(entries.map((e) => e.sm_field_key));

  // 2. Resolver field_type real para todos crm_field_id (uma query)
  const fieldIds = Array.from(
    new Set(
      entries
        .filter((e) => (e.action === "map" || e.action === "create_new") && e.crm_field_id)
        .map((e) => e.crm_field_id as string),
    ),
  );

  const fieldTypeById = new Map<string, string>();
  if (fieldIds.length > 0) {
    const { data: fields, error: fErr } = await supabase
      .from("deal_custom_fields")
      .select("id, field_type, is_active, tenant_id")
      .eq("tenant_id", tenantId)
      .in("id", fieldIds);
    if (fErr) throw fErr;
    for (const f of fields ?? []) {
      if ((f as any).is_active) {
        fieldTypeById.set((f as any).id as string, (f as any).field_type as string);
      }
    }
  }

  // 3. Montar Map resolvable + Set ignored + nativeTargets + lista invalid.
  const resolvable = new Map<string, { id: string; field_type: string }>();
  const nativeTargets = new Map<string, string>();
  const ignored = new Set<string>();
  const invalid: Array<{ sm_field_key: string; reason: string }> = [];

  for (const e of entries) {
    if (e.action === "ignore") {
      ignored.add(e.sm_field_key);
      continue;
    }
    if (e.action === "map_native") {
      const target = e.crm_native_target;
      if (!target) {
        invalid.push({ sm_field_key: e.sm_field_key, reason: "missing_crm_native_target" });
        continue;
      }
      if (!NATIVE_TARGET_WHITELIST.has(target)) {
        invalid.push({
          sm_field_key: e.sm_field_key,
          reason: `crm_native_target_not_whitelisted:${target}`,
        });
        continue;
      }
      nativeTargets.set(e.sm_field_key, target);
      continue;
    }
    if (!e.crm_field_id) {
      invalid.push({
        sm_field_key: e.sm_field_key,
        reason: "missing_crm_field_id",
      });
      continue;
    }
    const ftype = fieldTypeById.get(e.crm_field_id);
    if (!ftype) {
      invalid.push({
        sm_field_key: e.sm_field_key,
        reason: "crm_field_inactive_or_deleted",
      });
      continue;
    }
    resolvable.set(e.sm_field_key, {
      id: e.crm_field_id,
      field_type: ftype,
    });
  }

  // 4. Detectar slugs SM presentes no staging que NÃO estão em known
  //    (qualquer chave que comece com cap_/capo_/cape_).
  //    Usa DISTINCT em variables.key.
  const { data: smSlugs, error: sErr } = await supabase.rpc(
    "sm_distinct_proposta_variable_keys",
    { p_tenant_id: tenantId },
  );

  // Se a RPC não existir ainda, faz fallback via query direta no payload.
  let allSlugs: string[] = [];
  if (sErr || !Array.isArray(smSlugs)) {
    // Fallback: ler payloads e extrair (lento, mas seguro).
    const { data: rows } = await supabase
      .from("sm_propostas_raw")
      .select("payload")
      .eq("tenant_id", tenantId)
      .limit(2000);
    const set = new Set<string>();
    for (const r of rows ?? []) {
      const vars: any[] = Array.isArray((r as any).payload?.variables)
        ? (r as any).payload.variables
        : [];
      for (const v of vars) {
        const k = typeof v?.key === "string" ? v.key : null;
        if (!k) continue;
        if (/^(cap|capo|cape)_/.test(k)) set.add(k);
      }
    }
    allSlugs = Array.from(set);
  } else {
    allSlugs = (smSlugs as Array<{ key: string }>)
      .map((r) => r.key)
      .filter((k) => /^(cap|capo|cape)_/.test(k));
  }

  const unmapped = allSlugs.filter((k) => !known.has(k));

  return {
    resolved: { resolvable, nativeTargets, ignored, known },
    unmapped,
    invalid,
  };
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

    // 1. Carrega o lote de projetos.
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
          warnings: [],
          next_offset: null,
          duration_ms: Date.now() - startedAt,
        } satisfies PromoteResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = projetos[0].tenant_id as string;

    // 2. Carrega mapeamento do tenant + valida completude.
    const { resolved, unmapped, invalid } = await loadFieldMapping(
      supabase,
      tenantId,
    );

    if (unmapped.length > 0 || invalid.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "mapping_incomplete",
          message:
            "Há campos do SolarMarket sem mapeamento configurado em sm_custom_field_mapping. " +
            "Configure-os via Admin → Migração SolarMarket → Step 2 → Custom Fields.",
          unmapped_sm_keys: unmapped,
          invalid_mappings: invalid,
          tenant_id: tenantId,
          duration_ms: Date.now() - startedAt,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Carrega payloads das propostas correspondentes ao lote (uma query).
    const smIds = projetos.map((p: any) => Number(p.external_id)).filter(Boolean);
    const inList = smIds.map((id: number) => `"${id}"`).join(",");
    const { data: propostas, error: propErr } = smIds.length === 0
      ? { data: [] as any[], error: null }
      : await supabase
          .from("sm_propostas_raw")
          .select("payload")
          .filter("payload->>_sm_project_id", "in", `(${inList})`);
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
    let nativeUpdates = 0;
    const errors: Array<{ projeto_id?: string; deal_id?: string; error: string }> = [];
    const warnings: Array<{ projeto_id?: string; deal_id?: string; warning: string }> = [];
    const ignoredSeen = new Set<string>(); // dedup warnings

    /**
     * Bucket de updates nativos por projeto.
     * projetoId → { snapshotKeyPath[] : value }
     * snapshotKeyPath é o array de chaves DENTRO de snapshot
     * (ex.: ["garantias","modulo_sm"] vindo de "snapshot.garantias.modulo_sm").
     */
    const nativeBucket = new Map<string, Array<{ keys: string[]; value: string }>>();

    for (const proj of projetos) {
      const dealId = (proj as any).deal_id as string;
      const projetoId = (proj as any).id as string;
      const sm = propostasByProj.get(String((proj as any).external_id));
      if (!sm) continue;

      const variables: any[] = Array.isArray(sm?.variables) ? sm.variables : [];

      const rows: Array<Record<string, any>> = [];

      for (const v of variables) {
        const sourceKey = v?.key as string | undefined;
        if (!sourceKey) continue;

        // Slug ignorado pelo usuário → warning único, não migra.
        if (resolved.ignored.has(sourceKey)) {
          if (!ignoredSeen.has(sourceKey)) {
            warnings.push({
              warning: `slug '${sourceKey}' marcado como 'ignore' no mapeamento — pulando`,
            });
            ignoredSeen.add(sourceKey);
          }
          continue;
        }

        // Native target? grava no bucket e segue.
        const nativePath = resolved.nativeTargets.get(sourceKey);
        if (nativePath) {
          const rawValue = (v?.value ?? v?.formattedValue ?? "")
            .toString()
            .trim();
          if (!rawValue) continue;
          const keys = nativePathToSnapshotKeys(nativePath);
          if (!keys) continue;
          const arr = nativeBucket.get(projetoId) ?? [];
          arr.push({ keys, value: rawValue });
          nativeBucket.set(projetoId, arr);
          continue;
        }

        const def = resolved.resolvable.get(sourceKey);
        if (!def) continue; // slug fora do mapeamento (não deveria acontecer pós-validação)

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
          const urls = rawValue
            .split(/\s*\|\s*/)
            .filter((u: string) => /^https?:\/\//i.test(u));
          if (urls.length === 0) continue;
          const localPaths: string[] = [];
          for (const url of urls) {
            const fname = sanitizeFilename(url);
            const path = `sm/${tenantId}/${dealId}/${def.id}/${fname}`;
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
                  error: `download ${sourceKey}: ${r.reason}`,
                });
              }
            } catch (e) {
              filesFailed++;
              errors.push({
                projeto_id: projetoId,
                deal_id: dealId,
                error: `download ${sourceKey}: ${(e as Error).message}`,
              });
            }
          }
          if (localPaths.length === 0) continue;
          baseRow.value_text = JSON.stringify(localPaths);
        } else {
          // text / textarea / select / currency / boolean — gravado como texto.
          // (Conversões de tipo ficarão na próxima onda.)
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
      warnings: warnings.slice(0, 50),
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
