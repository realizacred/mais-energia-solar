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
const CUSTOM_FIELD_BUCKET = "imported-files";
const CLIENT_DOC_BUCKET = "documentos-clientes";

const DEFAULT_NATIVE_KEYS = new Set([
  "cap_identidade",
  "cap_comprovante_endereco",
  "cap_uc",
  "cap_concessionaria",
  "cap_docs",
  "cap_localizacao",
  "cap_disjuntor",
  "cap_transformador",
  "cap_data_instal",
  "cape_telhado",
  "capo_i",
  "capo_m",
  "capo_mi",
  "capo_overlord",
]);

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

function splitUrls(rawValue: unknown): string[] {
  return String(rawValue ?? "")
    .split(/\s*\|\s*/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

function firstValue(vars: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = vars.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

function toIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function extractNumber(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function mergeNote(existing: string | null | undefined, label: string, value: string | null): string | null {
  if (!value) return existing ?? null;
  const line = `[SM ${label}: ${value}]`;
  const current = (existing ?? "").trim();
  if (current.includes(line)) return current || null;
  return current ? `${current}\n${line}` : line;
}

async function downloadAndStore(
  supabase: any,
  bucket: string,
  url: string,
  storagePath: string,
): Promise<{ ok: boolean; path: string; reason?: string }> {
  // Skip if already exists.
  const { data: existing } = await supabase.storage
    .from(bucket)
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
    .from(bucket)
    .upload(storagePath, blob, {
      contentType,
      upsert: false,
    });
  if (upErr && !/exists/i.test(upErr.message)) {
    return { ok: false, path: storagePath, reason: upErr.message };
  }
  return { ok: true, path: storagePath };
}

async function resolveLookupId(
  supabase: any,
  table: "disjuntores" | "transformadores",
  tenantId: string,
  rawValue: string | null,
): Promise<string | null> {
  const numeric = extractNumber(rawValue);
  if (numeric === null) return null;
  const column = table === "disjuntores" ? "amperagem" : "potencia_kva";
  const { data } = await supabase
    .from(table)
    .select("id, descricao")
    .eq("tenant_id", tenantId)
    .eq(column, numeric)
    .eq("ativo", true)
    .limit(10);
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const rawLower = String(rawValue ?? "").toLowerCase();
  const phaseMatch = rows.find((row: any) => rawLower && String(row.descricao ?? "").toLowerCase() === rawLower);
  return (phaseMatch ?? rows[0]).id as string;
}

async function promoteNativeFields(
  supabase: any,
  args: {
    tenantId: string;
    projetoId: string;
    dealId: string;
    variables: any[];
    dryRun: boolean;
  },
): Promise<{ nativeUpdates: number; filesDownloaded: number; filesSkipped: number; filesFailed: number; errors: Array<{ projeto_id?: string; deal_id?: string; error: string }> }> {
  const values = new Map<string, string>();
  for (const v of args.variables) {
    const key = typeof v?.key === "string" ? v.key : null;
    if (!key) continue;
    const raw = (v?.value ?? v?.formattedValue ?? v?.displayValue ?? "").toString().trim();
    if (raw) values.set(key, raw);
  }

  const errors: Array<{ projeto_id?: string; deal_id?: string; error: string }> = [];
  let nativeUpdates = 0;
  let filesDownloaded = 0;
  let filesSkipped = 0;
  let filesFailed = 0;

  const { data: projetoRow } = await supabase
    .from("projetos")
    .select("cliente_id, observacoes")
    .eq("id", args.projetoId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();
  const clienteId = projetoRow?.cliente_id as string | undefined;
  if (!clienteId) return { nativeUpdates, filesDownloaded, filesSkipped, filesFailed, errors };

  const { data: clienteRow } = await supabase
    .from("clientes")
    .select("observacoes, identidade_urls, comprovante_endereco_urls, comprovante_beneficiaria_urls")
    .eq("id", clienteId)
    .eq("tenant_id", args.tenantId)
    .maybeSingle();

  const clientePatch: Record<string, any> = {};
  const projetoPatch: Record<string, any> = {};
  const versaoSnapshotPatch: Record<string, any> = {};
  const ucMetadataPatch: Record<string, any> = {};

  const downloadClientDocs = async (field: "identidade_urls" | "comprovante_endereco_urls" | "comprovante_beneficiaria_urls", sourceKey: string) => {
    const urls = splitUrls(values.get(sourceKey));
    if (urls.length === 0) return;
    const paths: string[] = [];
    for (const url of urls) {
      const path = `${args.tenantId}/${clienteId}/${field}/${Date.now()}-${sanitizeFilename(url)}`;
      if (args.dryRun) {
        paths.push(path);
        filesSkipped++;
        continue;
      }
      try {
        const result = await downloadAndStore(supabase, CLIENT_DOC_BUCKET, url, path);
        if (result.ok) {
          paths.push(result.path);
          if (result.reason === "already_exists") filesSkipped++;
          else filesDownloaded++;
        } else {
          filesFailed++;
          errors.push({ projeto_id: args.projetoId, deal_id: args.dealId, error: `download native ${sourceKey}: ${result.reason}` });
        }
      } catch (e) {
        filesFailed++;
        errors.push({ projeto_id: args.projetoId, deal_id: args.dealId, error: `download native ${sourceKey}: ${(e as Error).message}` });
      }
    }
    if (paths.length > 0) {
      const existing = Array.isArray(clienteRow?.[field]) ? clienteRow[field] : [];
      clientePatch[field] = Array.from(new Set([...existing, ...paths]));
    }
  };

  await downloadClientDocs("identidade_urls", "cap_identidade");
  await downloadClientDocs("comprovante_endereco_urls", "cap_comprovante_endereco");
  await downloadClientDocs("comprovante_beneficiaria_urls", "cap_uc");

  const localizacao = firstValue(values, ["cap_localizacao"]);
  if (localizacao) clientePatch.localizacao = localizacao;
  const dataInstalacao = toIsoDate(firstValue(values, ["cap_data_instal"]));
  if (dataInstalacao) {
    clientePatch.data_instalacao = dataInstalacao;
    projetoPatch.data_instalacao = dataInstalacao;
  }
  const disjuntorId = await resolveLookupId(supabase, "disjuntores", args.tenantId, firstValue(values, ["cap_disjuntor"]));
  if (disjuntorId) clientePatch.disjuntor_id = disjuntorId;
  const transformadorId = await resolveLookupId(supabase, "transformadores", args.tenantId, firstValue(values, ["cap_transformador"]));
  if (transformadorId) clientePatch.transformador_id = transformadorId;

  projetoPatch.observacoes = mergeNote(projetoRow?.observacoes, "Concessionária", firstValue(values, ["cap_concessionaria"]));
  projetoPatch.observacoes = mergeNote(projetoPatch.observacoes, "Docs", firstValue(values, ["cap_docs"]));
  clientePatch.observacoes = mergeNote(clienteRow?.observacoes, "Observações", firstValue(values, ["cap_obs"]));

  const tipoTelhado = firstValue(values, ["cape_telhado"]);
  if (tipoTelhado) versaoSnapshotPatch.tipo_telhado = tipoTelhado;
  const garantiaInversor = firstValue(values, ["capo_i"]);
  const garantiaModulo = firstValue(values, ["capo_m"]);
  const garantiaMicro = firstValue(values, ["capo_mi"]);
  if (garantiaInversor || garantiaModulo || garantiaMicro) {
    versaoSnapshotPatch.garantias = {
      ...(garantiaInversor ? { inversor_sm: garantiaInversor } : {}),
      ...(garantiaModulo ? { modulo_sm: garantiaModulo } : {}),
      ...(garantiaMicro ? { microinversor_sm: garantiaMicro } : {}),
    };
  }
  const overlord = firstValue(values, ["capo_overlord"]);
  if (overlord) versaoSnapshotPatch.overlord = overlord;

  const concessionaria = firstValue(values, ["cap_concessionaria"]);
  if (concessionaria) ucMetadataPatch.concessionaria_sm = concessionaria;
  const ucDocs = values.get("cap_uc");
  if (ucDocs) ucMetadataPatch.documentos_uc_sm = ucDocs;

  const applyUpdate = async (table: string, patch: Record<string, any>, id: string) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    if (Object.keys(clean).length === 0) return;
    if (args.dryRun) {
      nativeUpdates += Object.keys(clean).length;
      return;
    }
    const { data, error } = await supabase.from(table).update(clean).eq("id", id).eq("tenant_id", args.tenantId).select("id");
    if (error) errors.push({ projeto_id: args.projetoId, deal_id: args.dealId, error: `native ${table}: ${error.message}` });
    else if (data?.length) nativeUpdates += Object.keys(clean).length;
  };

  await applyUpdate("clientes", clientePatch, clienteId);
  await applyUpdate("projetos", projetoPatch, args.projetoId);

  if (Object.keys(versaoSnapshotPatch).length > 0 || Object.keys(ucMetadataPatch).length > 0) {
    const { data: latest } = await supabase
      .from("proposta_versoes")
      .select("id, snapshot, versao_numero, propostas_nativas!inner(projeto_id), proposta_versao_ucs(id, metadata)")
      .eq("tenant_id", args.tenantId)
      .eq("propostas_nativas.projeto_id", args.projetoId)
      .order("versao_numero", { ascending: false })
      .limit(1);
    const versao = latest?.[0];
    if (versao?.id && Object.keys(versaoSnapshotPatch).length > 0) {
      const snapshot = { ...(versao.snapshot ?? {}), ...versaoSnapshotPatch, garantias: { ...((versao.snapshot ?? {}).garantias ?? {}), ...(versaoSnapshotPatch.garantias ?? {}) } };
      await applyUpdate("proposta_versoes", { snapshot }, versao.id as string);
    }
    const uc = (versao as any)?.proposta_versao_ucs?.[0];
    if (uc?.id && Object.keys(ucMetadataPatch).length > 0 && !args.dryRun) {
      const metadata = { ...(uc.metadata ?? {}), ...ucMetadataPatch };
      const { error } = await supabase.from("proposta_versao_ucs").update({ metadata }).eq("id", uc.id);
      if (error) errors.push({ projeto_id: args.projetoId, deal_id: args.dealId, error: `native uc metadata: ${error.message}` });
      else nativeUpdates += Object.keys(ucMetadataPatch).length;
    } else if (uc?.id && Object.keys(ucMetadataPatch).length > 0) {
      nativeUpdates += Object.keys(ucMetadataPatch).length;
    }
  }

  return { nativeUpdates, filesDownloaded, filesSkipped, filesFailed, errors };
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
    const tenantIdFilter = typeof payload.tenant_id === "string" && payload.tenant_id.trim()
      ? payload.tenant_id.trim()
      : null;
    const projectExternalIdsFilter = Array.isArray(payload.project_external_ids)
      ? payload.project_external_ids.map((id: unknown) => String(id).trim()).filter(Boolean).slice(0, 20)
      : [];

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
    let projetosQuery = supabase
      .from("projetos")
      .select("id, deal_id, external_id, tenant_id")
      .eq("external_source", "solarmarket")
      .not("deal_id", "is", null)
      .not("external_id", "is", null)
      .order("external_id", { ascending: true });
    if (tenantIdFilter) projetosQuery = projetosQuery.eq("tenant_id", tenantIdFilter);
    if (projectExternalIdsFilter.length > 0) projetosQuery = projetosQuery.in("external_id", projectExternalIdsFilter);
    const { data: projetos, error: projErr } = await projetosQuery
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
          native_updates: 0,
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

    const mappingWarnings = [
      ...unmapped.map((key) => ({ warning: `slug '${key}' sem mapeamento — pulado` })),
      ...invalid.map((entry) => ({ warning: `mapeamento inválido '${entry.sm_field_key}' (${entry.reason}) — pulado` })),
    ];

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
    warnings.push(...mappingWarnings.slice(0, 50));
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

      const nativeResult = await promoteNativeFields(supabase, {
        tenantId,
        projetoId,
        dealId,
        variables,
        dryRun,
      });
      nativeUpdates += nativeResult.nativeUpdates;
      filesDownloaded += nativeResult.filesDownloaded;
      filesSkipped += nativeResult.filesSkipped;
      filesFailed += nativeResult.filesFailed;
      errors.push(...nativeResult.errors);

      const rows: Array<Record<string, any>> = [];

      for (const v of variables) {
        const sourceKey = v?.key as string | undefined;
        if (!sourceKey) continue;

        if (DEFAULT_NATIVE_KEYS.has(sourceKey)) continue;

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
              const r = await downloadAndStore(supabase, CUSTOM_FIELD_BUCKET, url, path);
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

    /* ---------------------------------------------------------------
     * Flush dos native targets em proposta_versoes.snapshot.
     *
     * Estratégia:
     *  1) Para cada projetoId no bucket, encontrar a versão mais recente
     *     em proposta_versoes (via propostas_nativas.projeto_id).
     *  2) Para cada par {keys, value}, aplicar jsonb_set aninhado em snapshot.
     *  3) Em dry-run: não escreve, só conta.
     * --------------------------------------------------------------- */
    if (nativeBucket.size > 0) {
      const projetoIds = Array.from(nativeBucket.keys());

      // Buscar versões mais recentes em uma query (versao DESC, primeira por projeto).
      const { data: versoes, error: vErr } = await supabase
        .from("proposta_versoes")
        .select("id, snapshot, versao_numero, propostas_nativas!inner(projeto_id)")
        .eq("propostas_nativas.tenant_id", tenantId)
        .in("propostas_nativas.projeto_id", projetoIds)
        .order("versao_numero", { ascending: false });

      if (vErr) {
        errors.push({ error: `native_targets_select: ${vErr.message}` });
      } else {
        // Pegar a primeira (maior versao) por projeto_id.
        const latestByProj = new Map<string, { id: string; snapshot: any }>();
        for (const v of versoes ?? []) {
          const pid = ((v as any).propostas_nativas?.projeto_id ?? null) as string | null;
          if (!pid) continue;
          if (!latestByProj.has(pid)) {
            latestByProj.set(pid, {
              id: (v as any).id as string,
              snapshot: (v as any).snapshot ?? {},
            });
          }
        }

        for (const [projetoId, ops] of nativeBucket.entries()) {
          const latest = latestByProj.get(projetoId);
          if (!latest) {
            warnings.push({
              projeto_id: projetoId,
              warning: "native_target: nenhuma versão de proposta encontrada — pulado",
            });
            continue;
          }

          // Mutar cópia do snapshot in-memory (jsonb_set aninhado em JS).
          const snapshot = JSON.parse(JSON.stringify(latest.snapshot ?? {}));
          for (const op of ops) {
            let cursor: any = snapshot;
            for (let i = 0; i < op.keys.length - 1; i++) {
              const k = op.keys[i];
              if (typeof cursor[k] !== "object" || cursor[k] === null) {
                cursor[k] = {};
              }
              cursor = cursor[k];
            }
            cursor[op.keys[op.keys.length - 1]] = op.value;
          }

          if (!dryRun) {
            const { error: uErr, count } = await supabase
              .from("proposta_versoes")
              .update({ snapshot }, { count: "exact" })
              .eq("id", latest.id);
            if (uErr) {
              errors.push({
                projeto_id: projetoId,
                error: `native_target_update: ${uErr.message}`,
              });
            } else if ((count ?? 0) === 0) {
              warnings.push({
                projeto_id: projetoId,
                warning: "native_target_update: 0 rows affected",
              });
            } else {
              nativeUpdates += ops.length;
            }
          } else {
            nativeUpdates += ops.length;
          }
        }
      }
    }

    const result: PromoteResult = {
      ok: true,
      processed: projetos.length,
      upserted,
      files_downloaded: filesDownloaded,
      files_skipped: filesSkipped,
      files_failed: filesFailed,
      native_updates: nativeUpdates,
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 50),
      next_offset: projectExternalIdsFilter.length > 0 || projetos.length < batch ? null : offset + batch,
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
