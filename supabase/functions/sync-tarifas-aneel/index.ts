// ──────────────────────────────────────────────────────────────────────────────
// sync-tarifas-aneel v4.0 — ANEEL Tariff Sync with Grupo A + B support
// Supports: full sync, single concessionária, test_run (dry-run) mode
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ANEEL_API_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
const ANEEL_RESOURCE_ID = "fcf2906c-7c32-4b9b-a637-054e7a5234f4";

interface TarifaAneel {
  SigAgente: string;
  NomAgente: string;
  DscREH: string;
  DscBaseTarifaria: string;
  DscSubGrupo: string;
  DscModalidadeTarifaria: string;
  NomPostoTarifario: string;
  DscDetalhe: string;
  DscClasse: string;
  DscSubClasse: string;
  VlrTUSD: string;
  VlrTE: string;
  DatInicioVigencia: string;
  DatFimVigencia: string;
  NumCNPJDistribuidora: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function resolveUserId(req: Request, anonKey: string): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (!error && data?.user?.id) return data.user.id;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch { return null; }
}

async function verifyAdminRole(req: Request): Promise<{
  authorized: boolean;
  userId: string | null;
  tenantId: string | null;
  error?: Response;
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userId = await resolveUserId(req, anonKey);
  if (!userId) {
    return {
      authorized: false, userId: null, tenantId: null,
      error: new Response(JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await adminClient
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();

  const tenantId = profile?.tenant_id || null;

  const { data: roles } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const isAdmin = roles?.some(r => ['admin', 'gerente', 'financeiro'].includes(r.role));
  if (!isAdmin) {
    return {
      authorized: false, userId, tenantId,
      error: new Response(JSON.stringify({ success: false, error: 'Apenas administradores podem sincronizar tarifas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    };
  }

  return { authorized: true, userId, tenantId };
}

// ── String normalization ──────────────────────────────────────────────────────

function normalizeStr(s: string | null | undefined): string {
  if (!s) return "";
  return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9\s]/g, "").trim();
}

function stripSuffixes(s: string): string {
  return s.replace(/\b(DISTRIBUICAO|DISTRIBUIDORA|DISTRIBUICOES|ENERGIA|ELETRICA|ELETRICIDADE|SA|S A|LTDA|CIA|COMPANHIA)\b/g, "").replace(/\s+/g, " ").trim();
}

const SIGLA_ALIASES: Record<string, string[]> = {
  "CEMIG": ["CEMIGD", "CEMIG-D"], "COPEL": ["COPELDIS", "COPEL-DIS"],
  "CPFL": ["CPFLPAULISTA", "CPFL PAULISTA"], "CPFL-PIR": ["CPFLPIRATINING", "CPFL PIRATININGA", "CPFLPIRATININGA"],
  "LIGHT": ["LIGHT SESA", "LIGHT"], "ENEL-RJ": ["ENEL RJ"], "ENEL-GO": ["EQUATORIAL GO"],
  "ENEL-CE": ["ENEL CE"], "ENEL-SP": ["ELETROPAULO"], "EDP-SP": ["EDP SP"], "EDP-ES": ["EDP ES"],
  "EMG": ["EMR", "ENERGISA MG"], "EPR": ["PACTO ENERGIA PR", "EPR"], "CELPE": ["NEOENERGIA PE"],
  "CEEE": ["CEEED", "CEEE-D"], "RRE": ["BOA VISTA"], "CEAL": ["EQUATORIAL AL"],
  "CELG": ["EQUATORIAL GO"], "CEMAR": ["EQUATORIAL MA"], "CELPA": ["EQUATORIAL PA"],
  "CEPISA": ["EQUATORIAL PI"], "CEB": ["NEOENERGIA BRASILIA"], "NEO-ELK": ["ELEKTRO"],
  "EMS": ["EMS"], "EMT": ["EMT"], "EPB": ["EPB"], "ERO": ["ERO"], "ESE": ["ESE"],
  "ETO": ["ETO"], "EAC": ["EAC"], "RGE": ["RGE"],
};

// ── SHA-256 hash ──────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Validation ────────────────────────────────────────────────────────────────

type ValidationStatus = 'ok' | 'atencao' | 'incompleto_gd3';

function validateTariffRecord(te: number, tusdTotal: number, _concNome: string): {
  status: ValidationStatus;
  notes: string[];
} {
  const notes: string[] = [];

  if (te <= 0) notes.push("TE negativa ou zero — dado suspeito");
  if (tusdTotal < 0) notes.push("TUSD negativo — dado suspeito");
  if (te > 2.0) notes.push(`TE muito alta (${te.toFixed(4)} R$/kWh) — verificar unidade`);
  if (tusdTotal > 2.0) notes.push(`TUSD muito alto (${tusdTotal.toFixed(4)} R$/kWh) — verificar unidade`);
  if (te + tusdTotal > 3.0) notes.push("Tarifa total > R$ 3,00/kWh — possível erro de unidade");

  const hasGd3Data = false;
  const status: ValidationStatus =
    notes.some(n => n.includes("suspeito") || n.includes("erro")) ? 'atencao' :
    !hasGd3Data ? 'incompleto_gd3' : 'ok';

  return { status, notes };
}

// ── Precision detection ───────────────────────────────────────────────────────

function detectPrecisao(concFioBManual: number | null, tusdTotalAneel: number): {
  precisao: 'exato' | 'estimado';
  tusd_fio_b_real: number | null;
} {
  if (concFioBManual != null && concFioBManual > 0 && Math.abs(concFioBManual - tusdTotalAneel) > 0.000001) {
    return { precisao: 'exato', tusd_fio_b_real: concFioBManual };
  }
  return { precisao: 'estimado', tusd_fio_b_real: null };
}

// ── Match ANEEL record to concessionária ─────────────────────────────────────

function matchAgentToConc(
  agenteSig: string,
  agenteNom: string,
  conc: { nome: string; sigla: string | null },
): boolean {
  const concSiglaNorm = normalizeStr(conc.sigla);
  const concNomeNorm = normalizeStr(conc.nome);
  const agSigNorm = normalizeStr(agenteSig);
  const agNomNorm = normalizeStr(agenteNom);

  // Direct sigla match
  if (concSiglaNorm && agSigNorm === concSiglaNorm) return true;

  // Alias match
  if (conc.sigla) {
    for (const alias of (SIGLA_ALIASES[conc.sigla.toUpperCase()] || [])) {
      const aliasNorm = normalizeStr(alias);
      if (agSigNorm === aliasNorm || agNomNorm === aliasNorm) return true;
    }
  }

  // Name match
  if (agNomNorm === concNomeNorm) return true;

  // Stripped match
  const strippedConc = stripSuffixes(concNomeNorm);
  const strippedAg = stripSuffixes(agSigNorm);
  const strippedAgNom = stripSuffixes(agNomNorm);
  if (strippedConc && (strippedConc === strippedAg || strippedConc === strippedAgNom ||
    strippedConc.includes(strippedAg) || strippedAg.includes(strippedConc) ||
    strippedConc.includes(strippedAgNom) || strippedAgNom.includes(strippedConc))) return true;

  // Sigla partial
  if (concSiglaNorm && (agSigNorm.includes(concSiglaNorm) || concSiglaNorm.includes(agSigNorm))) return true;

  return false;
}

function findTarifaForConc(
  conc: { nome: string; sigla: string | null },
  tarifasPorAgente: Record<string, TarifaAneel>,
  tarifasPorNome: Record<string, TarifaAneel>
): TarifaAneel | undefined {
  if (conc.sigla) {
    const t = tarifasPorAgente[normalizeStr(conc.sigla)];
    if (t) return t;
  }
  if (conc.sigla) {
    for (const alias of (SIGLA_ALIASES[conc.sigla.toUpperCase()] || [])) {
      const t = tarifasPorAgente[normalizeStr(alias)] || tarifasPorNome[normalizeStr(alias)];
      if (t) return t;
    }
  }
  const t3 = tarifasPorNome[normalizeStr(conc.nome)];
  if (t3) return t3;
  const stripped = stripSuffixes(normalizeStr(conc.nome));
  for (const [k, v] of Object.entries(tarifasPorAgente)) {
    if (stripped === stripSuffixes(k) || stripped.includes(stripSuffixes(k)) || stripSuffixes(k).includes(stripped)) return v;
  }
  for (const [k, v] of Object.entries(tarifasPorNome)) {
    if (stripped.includes(stripSuffixes(k)) || stripSuffixes(k).includes(stripped)) return v;
  }
  if (conc.sigla) {
    const siglaNorm = normalizeStr(conc.sigla);
    for (const [k, v] of Object.entries(tarifasPorAgente)) {
      if (k.includes(siglaNorm) || siglaNorm.includes(k)) return v;
    }
  }
  return undefined;
}

// ── Minimum vigência year — only fetch recent tariffs ────────────────────────
const MIN_VIGENCIA_YEAR = 2024;

// ── Fetch ANEEL API with pagination ──────────────────────────────────────────

async function fetchAneelRecords(
  filters: Record<string, string>,
  log: (msg: string) => void,
  limit = 500,
): Promise<TarifaAneel[]> {
  const allRecords: TarifaAneel[] = [];
  let offset = 0;
  const maxPages = 10; // Safety limit

  for (let page = 0; page < maxPages; page++) {
    const filtersStr = JSON.stringify(filters);
    // Use SQL-style filter to only get records from MIN_VIGENCIA_YEAR onwards
    const sqlWhere = `"DatInicioVigencia" >= '${MIN_VIGENCIA_YEAR}-01-01'`;
    const url = `${ANEEL_API_URL}?resource_id=${ANEEL_RESOURCE_ID}&filters=${encodeURIComponent(filtersStr)}&q=&limit=${limit}&offset=${offset}&sort=DatInicioVigencia desc`;

    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      log(`ERRO API ANEEL: ${response.status} — ${errText.substring(0, 200)}`);
      throw new Error(`ANEEL API error ${response.status}`);
    }

    const data = await response.json();
    if (!data.success || !data.result?.records) {
      throw new Error("Resposta inesperada da API ANEEL");
    }

    const records = data.result.records as TarifaAneel[];
    allRecords.push(...records);

    // If we got fewer records than limit, we've reached the end
    if (records.length < limit) break;
    offset += limit;
  }

  // Post-filter: only keep records with vigência >= MIN_VIGENCIA_YEAR
  const minDate = `${MIN_VIGENCIA_YEAR}-01-01`;
  const filtered = allRecords.filter(r => {
    if (!r.DatInicioVigencia) return false;
    return r.DatInicioVigencia.substring(0, 10) >= minDate;
  });

  if (filtered.length < allRecords.length) {
    log(`📅 Filtro de vigência: ${allRecords.length} → ${filtered.length} registros (≥ ${MIN_VIGENCIA_YEAR})`);
  }

  return filtered;
}

// ── Group A: Aggregate Ponta/Fora Ponta records per agent+subgrupo+modalidade ─

interface GrupoATarifaAgregada {
  sigAgente: string;
  nomAgente: string;
  subgrupo: string;
  modalidade: string;
  te_ponta: number;
  tusd_ponta: number;
  te_fora_ponta: number;
  tusd_fora_ponta: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  raw_records: TarifaAneel[];
}

function aggregateGrupoARecords(records: TarifaAneel[]): GrupoATarifaAgregada[] {
  // Group by agent + subgrupo + modalidade + vigência
  const grouped = new Map<string, TarifaAneel[]>();

  for (const r of records) {
    // Only use "Tarifa de Aplicação" records
    if (!r.DscBaseTarifaria || !r.DscBaseTarifaria.toLowerCase().includes("aplica")) continue;

    const key = `${normalizeStr(r.SigAgente)}|${normalizeStr(r.NomAgente)}|${normalizeStr(r.DscSubGrupo)}|${normalizeStr(r.DscModalidadeTarifaria)}|${r.DatInicioVigencia}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const result: GrupoATarifaAgregada[] = [];

  for (const [_key, recs] of grouped) {
    const ref = recs[0];
    let te_ponta = 0, tusd_ponta = 0, te_fora_ponta = 0, tusd_fora_ponta = 0;

    for (const r of recs) {
      const posto = normalizeStr(r.NomPostoTarifario);
      const tusd = parseFloat(r.VlrTUSD) || 0;
      const te = parseFloat(r.VlrTE) || 0;

      // Convert MWh → kWh
      const tusdKwh = Math.round(tusd / 1000 * 1000000) / 1000000;
      const teKwh = Math.round(te / 1000 * 1000000) / 1000000;

      if (posto.includes("PONTA") && !posto.includes("FORA")) {
        // "Ponta" (not "Fora ponta")
        te_ponta = teKwh;
        tusd_ponta = tusdKwh;
      } else if (posto.includes("FORA")) {
        // "Fora ponta"
        te_fora_ponta = teKwh;
        tusd_fora_ponta = tusdKwh;
      }
    }

    // Only add if we have at least one valid value
    if (te_ponta > 0 || tusd_ponta > 0 || te_fora_ponta > 0 || tusd_fora_ponta > 0) {
      const vigenciaFim = ref.DatFimVigencia && ref.DatFimVigencia !== '0001-01-01'
        ? ref.DatFimVigencia.substring(0, 10)
        : null;

      result.push({
        sigAgente: ref.SigAgente,
        nomAgente: ref.NomAgente,
        subgrupo: ref.DscSubGrupo,
        modalidade: ref.DscModalidadeTarifaria,
        te_ponta,
        tusd_ponta,
        te_fora_ponta,
        tusd_fora_ponta,
        vigencia_inicio: ref.DatInicioVigencia?.substring(0, 10) || new Date().toISOString().substring(0, 10),
        vigencia_fim: vigenciaFim,
        raw_records: recs,
      });
    }
  }

  // Deduplicate: keep only most recent vigência per agent+subgrupo+modalidade
  const deduped = new Map<string, GrupoATarifaAgregada>();
  for (const item of result) {
    const dedupKey = `${normalizeStr(item.sigAgente)}|${normalizeStr(item.nomAgente)}|${item.subgrupo}|${item.modalidade}`;
    const existing = deduped.get(dedupKey);
    if (!existing || item.vigencia_inicio > existing.vigencia_inicio) {
      deduped.set(dedupKey, item);
    }
  }

  return Array.from(deduped.values());
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authCheck = await verifyAdminRole(req);
    if (!authCheck.authorized) return authCheck.error!;

    const { userId, tenantId } = authCheck;

    if (!tenantId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tenant não encontrado para o usuário. Verifique o cadastro do perfil.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let concessionariaId: string | null = null;
    let triggerType: string = 'manual';
    let testRun = false;
    try {
      const body = await req.json();
      concessionariaId = body?.concessionaria_id || null;
      triggerType = body?.trigger_type || 'manual';
      testRun = body?.test_run === true;
    } catch { /* no body */ }

    // ── Create run record ─────────────────────────────────────────────────────
    const { data: runData, error: runError } = await supabase
      .from('aneel_sync_runs')
      .insert({
        tenant_id: tenantId,
        triggered_by: userId,
        trigger_type: testRun ? 'test_run' : triggerType,
        status: 'running',
        logs: [],
      })
      .select('id')
      .single();

    if (runError) throw runError;
    const runId = runData.id;
    const runLogs: string[] = [];

    const log = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}`;
      console.log(line);
      runLogs.push(line);
    };

    log(`Sync v4.0 iniciado — tenant=${tenantId}, trigger=${testRun ? 'test_run' : triggerType}, runId=${runId}`);
    if (testRun) log("🧪 MODO TEST RUN — nenhuma alteração será publicada");

    // ── Fetch concessionárias ─────────────────────────────────────────────────
    let query = supabase.from('concessionarias')
      .select('id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, aliquota_icms, possui_isencao_scee, percentual_isencao')
      .eq('tenant_id', tenantId);

    if (concessionariaId) query = query.eq('id', concessionariaId);

    const { data: concessionarias, error: concError } = await query;
    if (concError) throw concError;

    log(`${concessionarias?.length || 0} concessionária(s) a processar`);

    if (!concessionarias || concessionarias.length === 0) {
      await supabase.from('aneel_sync_runs').update({
        status: 'success', finished_at: new Date().toISOString(),
        logs: runLogs, total_fetched: 0, total_matched: 0, total_updated: 0,
      }).eq('id', runId);
      return new Response(JSON.stringify({ success: true, message: "Nenhuma concessionária", run_id: runId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Fetch & Process BT (B1 Convencional) — existing logic
    // ══════════════════════════════════════════════════════════════════════════

    log("═══ FASE 1: Tarifas BT (B1 Convencional) ═══");

    const btRecords = await fetchAneelRecords({
      DscSubGrupo: "B1",
      DscModalidadeTarifaria: "Convencional",
      DscDetalhe: "Não se aplica",
      DscBaseTarifaria: "Tarifa de Aplicação",
    }, log);

    const snapshotHash = await sha256(JSON.stringify(btRecords));
    log(`ANEEL BT retornou ${btRecords.length} registros — hash=${snapshotHash.substring(0, 16)}...`);

    // Build lookup indexes for BT
    const tarifasPorAgente: Record<string, TarifaAneel> = {};
    const tarifasPorNome: Record<string, TarifaAneel> = {};
    for (const t of btRecords) {
      if (t.SigAgente) {
        const k = normalizeStr(t.SigAgente);
        if (!tarifasPorAgente[k] || t.DatInicioVigencia > tarifasPorAgente[k].DatInicioVigencia)
          tarifasPorAgente[k] = t;
      }
      if (t.NomAgente) {
        const k = normalizeStr(t.NomAgente);
        if (!tarifasPorNome[k] || t.DatInicioVigencia > tarifasPorNome[k].DatInicioVigencia)
          tarifasPorNome[k] = t;
      }
    }

    // Process BT for each concessionária
    const resultados: object[] = [];
    const erros: { concessionaria: string; erro: string }[] = [];
    let totalUpdated = 0;
    let totalMatched = 0;

    for (const conc of concessionarias) {
      const tarifa = findTarifaForConc(conc, tarifasPorAgente, tarifasPorNome);

      if (!tarifa) {
        log(`⚠️ BT NÃO ENCONTRADO: ${conc.nome} (sigla=${conc.sigla || '?'})`);
        erros.push({ concessionaria: conc.nome, erro: `BT: Não encontrada na ANEEL. Sigla: "${conc.sigla || ''}"` });
        continue;
      }

      totalMatched++;

      // Convert MWh → kWh
      const tusdMwh = parseFloat(tarifa.VlrTUSD) || 0;
      const teMwh = parseFloat(tarifa.VlrTE) || 0;
      const tusdTotal = Math.round(tusdMwh / 1000 * 1000000) / 1000000;
      const te = Math.round(teMwh / 1000 * 1000000) / 1000000;
      const tarifaTotal = Math.round((tusdTotal + te) * 1000000) / 1000000;

      const { status: validStatus, notes: validNotes } = validateTariffRecord(te, tusdTotal, conc.nome);
      const { precisao, tusd_fio_b_real } = detectPrecisao(conc.tarifa_fio_b, tusdTotal);

      const recordHash = await sha256(JSON.stringify(tarifa));
      const vigenciaInicio = tarifa.DatInicioVigencia ? tarifa.DatInicioVigencia.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const vigenciaFim = tarifa.DatFimVigencia && tarifa.DatFimVigencia !== '0001-01-01' ? tarifa.DatFimVigencia.substring(0, 10) : null;

      const precLabel = precisao === 'exato' ? 'EXATO (Fio B real)' : 'ESTIMADO (TUSD total como proxy)';
      log(`📊 BT ${conc.nome} → TE=${te.toFixed(6)}, TUSD total=${tusdTotal.toFixed(6)}, FioB real=${tusd_fio_b_real?.toFixed(6) ?? 'N/A'} → ${precLabel}`);

      if (!testRun) {
        // Deactivate previous active version
        await supabase.from('tariff_versions')
          .update({ is_active: false })
          .eq('concessionaria_id', conc.id)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

        // Create new versioned record
        const { error: tvError } = await supabase.from('tariff_versions').insert({
          tenant_id: tenantId,
          concessionaria_id: conc.id,
          run_id: runId,
          vigencia_inicio: vigenciaInicio,
          vigencia_fim: vigenciaFim,
          is_active: true,
          origem: 'ANEEL',
          te_kwh: te,
          tusd_total_kwh: tusdTotal,
          tusd_fio_b_kwh: tusd_fio_b_real,
          tarifa_total_kwh: tarifaTotal,
          custo_disp_mono: conc.custo_disponibilidade_monofasico,
          custo_disp_bi: conc.custo_disponibilidade_bifasico,
          custo_disp_tri: conc.custo_disponibilidade_trifasico,
          aliquota_icms: conc.aliquota_icms,
          possui_isencao: conc.possui_isencao_scee || false,
          percentual_isencao: conc.percentual_isencao,
          snapshot_raw: tarifa as unknown as Record<string, unknown>,
          snapshot_hash: recordHash,
          validation_status: validStatus,
          validation_notes: validNotes,
          published_at: new Date().toISOString(),
          precisao,
        });

        if (tvError) {
          log(`⚠️ Erro ao criar tariff_version para ${conc.nome}: ${tvError.message}`);
          erros.push({ concessionaria: conc.nome, erro: tvError.message });
          continue;
        }

        // Also update concessionarias (backward compat)
        await supabase.from('concessionarias').update({
          tarifa_energia: tarifaTotal,
          tarifa_fio_b: tusd_fio_b_real ?? tusdTotal,
          ultima_sync_tarifas: new Date().toISOString(),
        }).eq('id', conc.id);

        // ── Upsert BT subgroups in concessionaria_tarifas_subgrupo ──
        const btSubgroups = ['B1', 'B2', 'B3'];
        for (const sub of btSubgroups) {
          await supabase.from('concessionaria_tarifas_subgrupo')
            .upsert({
              concessionaria_id: conc.id,
              tenant_id: tenantId,
              subgrupo: sub,
              modalidade_tarifaria: 'Convencional',
              tarifa_energia: tarifaTotal,
              tarifa_fio_b: tusd_fio_b_real ?? tusdTotal,
              origem: 'ANEEL',
              is_active: true,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'concessionaria_id,subgrupo,tenant_id',
              ignoreDuplicates: false,
            });
        }
        log(`📦 Subgrupos BT atualizados para ${conc.nome}`);

        totalUpdated++;
        log(`✅ BT ${conc.nome} → TE=${te.toFixed(6)} + TUSD=${tusdTotal.toFixed(6)} = ${tarifaTotal.toFixed(6)} R$/kWh | vigência=${vigenciaInicio} | ${precLabel} | auditoria=${validStatus}`);
      } else {
        log(`🧪 [DRY-RUN] BT ${conc.nome} → TE=${te.toFixed(6)} + TUSD=${tusdTotal.toFixed(6)} = ${tarifaTotal.toFixed(6)} | ${precLabel} | auditoria=${validStatus}`);
        totalUpdated++;
      }

      resultados.push({
        grupo: 'B',
        concessionaria: conc.nome,
        tarifa_anterior: conc.tarifa_energia,
        tarifa_nova: tarifaTotal,
        te,
        tusd_total: tusdTotal,
        tusd_fio_b_real,
        precisao,
        vigencia: vigenciaInicio,
        validation_status: validStatus,
        validation_notes: validNotes,
        sincronizado: !testRun,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Fetch & Process Grupo A (MT) — NEW
    // ══════════════════════════════════════════════════════════════════════════

    log("═══ FASE 2: Tarifas Grupo A (Média/Alta Tensão) ═══");

    let totalMtUpdated = 0;
    let totalMtMatched = 0;

    // Fetch all Group A subgroups at once (the API supports multiple via OR-like behavior)
    // We fetch all records and filter client-side for flexibility
    const MT_SUBGRUPOS = ['A1', 'A2', 'A3', 'A3a', 'A4', 'AS'];
    const MT_MODALIDADES = ['Azul', 'Verde'];

    const allMtRecords: TarifaAneel[] = [];

    for (const subgrupo of MT_SUBGRUPOS) {
      for (const modalidade of MT_MODALIDADES) {
        try {
          const records = await fetchAneelRecords({
            DscSubGrupo: subgrupo,
            DscModalidadeTarifaria: modalidade,
            DscBaseTarifaria: "Tarifa de Aplicação",
          }, log, 500);
          allMtRecords.push(...records);
          if (records.length > 0) {
            log(`📡 ANEEL MT: ${subgrupo}/${modalidade} → ${records.length} registros`);
          }
        } catch (err) {
          log(`⚠️ Erro ao buscar ${subgrupo}/${modalidade}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    log(`Total registros MT brutos: ${allMtRecords.length}`);

    if (allMtRecords.length > 0) {
      // Aggregate Ponta/Fora Ponta records
      const aggregated = aggregateGrupoARecords(allMtRecords);
      log(`Tarifas MT agregadas: ${aggregated.length} combinações subgrupo/modalidade/distribuidora`);

      // Process each concessionária
      for (const conc of concessionarias) {
        // Find all MT tarifas that match this concessionária
        const concMtTarifas = aggregated.filter(a =>
          matchAgentToConc(a.sigAgente, a.nomAgente, conc)
        );

        if (concMtTarifas.length === 0) continue;

        totalMtMatched++;
        log(`🔍 MT ${conc.nome}: ${concMtTarifas.length} subgrupo(s) encontrado(s)`);

        for (const mt of concMtTarifas) {
          const subgrupoLabel = `${mt.subgrupo}`;
          const modalidadeLabel = mt.modalidade;

          log(`  📊 ${subgrupoLabel}/${modalidadeLabel} → TE_P=${mt.te_ponta.toFixed(6)}, TE_FP=${mt.te_fora_ponta.toFixed(6)}, TUSD_P=${mt.tusd_ponta.toFixed(6)}, TUSD_FP=${mt.tusd_fora_ponta.toFixed(6)}`);

          if (!testRun) {
            // Check if there's already a manual record — don't overwrite manual data
            const { data: existing } = await supabase
              .from('concessionaria_tarifas_subgrupo')
              .select('id, origem')
              .eq('concessionaria_id', conc.id)
              .eq('tenant_id', tenantId)
              .eq('subgrupo', mt.subgrupo)
              .eq('modalidade_tarifaria', modalidadeLabel)
              .maybeSingle();

            if (existing?.origem === 'manual') {
              log(`  ⏭️ ${subgrupoLabel}/${modalidadeLabel} — mantido (origem manual)`);
              continue;
            }

            const { error: upsertError } = await supabase
              .from('concessionaria_tarifas_subgrupo')
              .upsert({
                concessionaria_id: conc.id,
                tenant_id: tenantId,
                subgrupo: mt.subgrupo,
                modalidade_tarifaria: modalidadeLabel,
                te_ponta: mt.te_ponta,
                te_fora_ponta: mt.te_fora_ponta,
                tusd_ponta: mt.tusd_ponta,
                tusd_fora_ponta: mt.tusd_fora_ponta,
                vigencia_inicio: mt.vigencia_inicio,
                origem: 'ANEEL',
                is_active: true,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'concessionaria_id,subgrupo,tenant_id',
                ignoreDuplicates: false,
              });

            if (upsertError) {
              log(`  ⚠️ Erro upsert MT ${subgrupoLabel}/${modalidadeLabel}: ${upsertError.message}`);
              erros.push({ concessionaria: `${conc.nome} (${subgrupoLabel})`, erro: upsertError.message });
            } else {
              totalMtUpdated++;
              log(`  ✅ ${subgrupoLabel}/${modalidadeLabel} atualizado via ANEEL`);
            }
          } else {
            log(`  🧪 [DRY-RUN] ${subgrupoLabel}/${modalidadeLabel} seria atualizado`);
            totalMtUpdated++;
          }

          resultados.push({
            grupo: 'A',
            concessionaria: conc.nome,
            subgrupo: mt.subgrupo,
            modalidade: modalidadeLabel,
            te_ponta: mt.te_ponta,
            te_fora_ponta: mt.te_fora_ponta,
            tusd_ponta: mt.tusd_ponta,
            tusd_fora_ponta: mt.tusd_fora_ponta,
            vigencia: mt.vigencia_inicio,
            sincronizado: !testRun,
          });
        }
      }
    }

    log(`MT concluído: ${totalMtMatched} concessionárias com dados MT, ${totalMtUpdated} subgrupos ${testRun ? 'simulados' : 'atualizados'}`);

    // ── Finalize run ──────────────────────────────────────────────────────────
    const grandTotalUpdated = totalUpdated + totalMtUpdated;
    const grandTotalFetched = btRecords.length + allMtRecords.length;

    const finalStatus = testRun ? 'test_run' :
      erros.length === 0 ? 'success' : grandTotalUpdated > 0 ? 'partial' : 'error';
    await supabase.from('aneel_sync_runs').update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      total_fetched: grandTotalFetched,
      total_matched: totalMatched + totalMtMatched,
      total_updated: grandTotalUpdated,
      total_errors: erros.length,
      snapshot_hash: snapshotHash,
      logs: runLogs,
    }).eq('id', runId);

    log(`Sync concluído: BT=${totalUpdated}, MT=${totalMtUpdated} ${testRun ? 'simuladas' : 'atualizadas'}, ${erros.length} erros. Status=${finalStatus}`);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      status: finalStatus,
      test_run: testRun,
      message: testRun
        ? `Test run: ${grandTotalUpdated} registro(s) seriam atualizados (BT=${totalUpdated}, MT=${totalMtUpdated})`
        : `Tarifas atualizadas: BT=${totalUpdated}, MT=${totalMtUpdated} concessionária(s)`,
      resultados,
      erros,
      fonte: "ANEEL - Dados Abertos (Tarifas Homologadas BT + MT)",
      total_aneel_bt: btRecords.length,
      total_aneel_mt: allMtRecords.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("[sync-tarifas-aneel] Erro:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
