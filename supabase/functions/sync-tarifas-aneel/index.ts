// ──────────────────────────────────────────────────────────────────────────────
// sync-tarifas-aneel v7.0 — Versioning + Chunking + Governance
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ANEEL_API_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search";
const ANEEL_RESOURCE_ID = "fcf2906c-7c32-4b9b-a637-054e7a5234f4";
const DB_BATCH_SIZE = 50;
const MIN_VIGENCIA_YEAR = 2024;

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

/**
 * Returns true if this ANEEL record is a Social/Low-Income tariff
 * that should NOT be used for standard residential pricing.
 */
function isTarifaSocial(record: TarifaAneel): boolean {
  const sub = (record.DscSubClasse || '').toLowerCase();
  return sub.includes('social') || sub.includes('baixa renda');
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
  const { data: profile } = await adminClient.from('profiles').select('tenant_id').eq('user_id', userId).single();
  const tenantId = profile?.tenant_id || null;
  const { data: roles } = await adminClient.from('user_roles').select('role').eq('user_id', userId);
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
  return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
}

function stripSuffixes(s: string): string {
  return s.replace(/(DISTRIBUICAO|DISTRIBUIDORA|DISTRIBUICOES|ENERGIA|ELETRICA|ELETRICIDADE|SA|LTDA|CIA|COMPANHIA|DIS|DISTRIBUICAOSA)/g, "").replace(/\s+/g, "").trim();
}

// ── Comprehensive matching aliases ───────────────────────────────────────────
const SIGLA_ALIASES: Record<string, string[]> = {
  "CEMIG":    ["CEMIG", "CEMIGD", "CEMIG-D", "CEMIG DISTRIBUICAO", "CEMIG DISTRIBUICAO SA"],
  "COPEL":    ["COPEL", "COPELDIS", "COPEL-DIS", "COPEL DISTRIBUICAO"],
  "CPFL":     ["CPFL", "CPFLPAULISTA", "CPFL PAULISTA", "CPFL-PAULISTA"],
  "CPFL-PIR": ["CPFLPIRATININGA", "CPFL PIRATININGA", "CPFL-PIRATININGA", "PIRATININGA"],
  "EDP-ES":   ["EDPES", "EDP ES", "EDP-ES", "ESCELSA", "EDP ESPIRITO SANTO"],
  "EDP-SP":   ["EDPSP", "EDP SP", "EDP-SP", "BANDEIRANTE", "EDP SAO PAULO"],
  "ENEL-CE":  ["ENELCE", "ENEL CE", "ENEL-CE", "COELCE", "ENEL CEARA"],
  "ENEL-RJ":  ["ENELRJ", "ENEL RJ", "ENEL-RJ", "ENEL DISTRIBUICAO RIO"],
  "ENEL-GO":  ["ENELGO", "ENEL GO", "ENEL-GO", "ENEL GOIAS", "ENEL DISTRIBUICAO GOIAS"],
  "ENEL-SP":  ["ENELSP", "ENEL SP", "ENEL-SP", "ELETROPAULO", "ENEL SAO PAULO"],
  "LIGHT":    ["LIGHT", "LIGHTSESA", "LIGHT SESA", "LIGHT-SESA", "LIGHT SA", "LIGHT SERVICOS"],
  "CELESC":   ["CELESC", "CELESCDIS", "CELESC-DIS", "CELESC DISTRIBUICAO"],
  "CEEE":     ["CEEE", "CEEED", "CEEE-D", "CEEE EQUATORIAL", "EQUATORIAL RS"],
  "ELEKTRO":  ["ELEKTRO", "ELEKTRO REDES", "NEOENERGIA ELEKTRO"],
  "NEO-ELK":  ["ELEKTRO", "ELEKTRO REDES", "NEOENERGIA ELEKTRO"],
  "CELPE":    ["CELPE", "NEOENERGIA PE", "NEOENERGIA PERNAMBUCO", "NEOENERGIA CELPE"],
  "COELBA":   ["COELBA", "NEOENERGIA BA", "NEOENERGIA BAHIA", "NEOENERGIA COELBA"],
  "COSERN":   ["COSERN", "NEOENERGIA RN", "NEOENERGIA COSERN"],
  "CEB":      ["CEB", "CEBD", "CEB-D", "CEB DISTRIBUICAO", "NEOENERGIA BRASILIA", "NEOENERGIA CEB"],
  "EAC":      ["EAC", "EACRE", "ENERGISA AC", "ENERGISA ACRE"],
  "EMG":      ["EMG", "EMR", "ENERGISA MG", "ENERGISA MINAS GERAIS", "ENERGISA MINAS", "ENERGISA MINAS RIO", "ENERGISA NOVA FRIBURGO", "ENF"],
  "EMS":      ["EMS", "ENERGISA MS", "ENERGISA MATO GROSSO DO SUL"],
  "EMT":      ["EMT", "ENERGISA MT", "ENERGISA MATO GROSSO"],
  "EPB":      ["EPB", "ENERGISA PB", "ENERGISA PARAIBA"],
  "EPR":      ["EPR", "ENERGISA PR", "ENERGISA PARANA", "PACTO ENERGIA PR"],
  "ERO":      ["ERO", "ENERGISA RO", "ENERGISA RONDONIA"],
  "ESE":      ["ESE", "ENERGISA SE", "ENERGISA SERGIPE"],
  "ETO":      ["ETO", "ENERGISA TO", "ENERGISA TOCANTINS"],
  "CEAL":     ["CEAL", "EQUATORIAL AL", "EQUATORIAL ALAGOAS"],
  "CELG":     ["CELG", "CELGD", "CELG-D", "EQUATORIAL GO", "EQUATORIAL GOIAS"],
  "CEMAR":    ["CEMAR", "EQUATORIAL MA", "EQUATORIAL MARANHAO"],
  "CELPA":    ["CELPA", "EQUATORIAL PA", "EQUATORIAL PARA"],
  "CEPISA":   ["CEPISA", "EQUATORIAL PI", "EQUATORIAL PIAUI"],
  "AME":      ["AME", "AMAZONAS ENERGIA", "AMAZONAS DISTRIBUIDORA"],
  "CEA":      ["CEA", "CEA EQUATORIAL", "EQUATORIAL AP", "EQUATORIAL AMAPA"],
  "RGE":      ["RGE", "RGESUL", "RGE SUL", "RGE-SUL"],
  "RRE":      ["RRE", "BOA VISTA", "RORAIMA ENERGIA", "BOA VISTA ENERGIA"],
};

// ── SHA-256 hash ──────────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateTariffRecord(te: number, tusdTotal: number): {
  status: string;
  notes: string[];
} {
  const notes: string[] = [];
  if (te <= 0) notes.push("TE negativa ou zero — dado suspeito");
  if (tusdTotal < 0) notes.push("TUSD negativo — dado suspeito");
  if (te > 2.0) notes.push(`TE muito alta (${te.toFixed(4)} R$/kWh) — verificar unidade`);
  if (tusdTotal > 2.0) notes.push(`TUSD muito alto (${tusdTotal.toFixed(4)} R$/kWh) — verificar unidade`);
  if (te + tusdTotal > 3.0) notes.push("Tarifa total > R$ 3,00/kWh — possível erro de unidade");
  const status = notes.some(n => n.includes("suspeito") || n.includes("erro")) ? 'atencao' : 'incompleto_gd3';
  return { status, notes };
}

function detectPrecisao(concFioBManual: number | null, tusdTotalAneel: number): {
  precisao: 'exato' | 'estimado';
  tusd_fio_b_real: number | null;
} {
  if (concFioBManual != null && concFioBManual > 0 && Math.abs(concFioBManual - tusdTotalAneel) > 0.000001) {
    return { precisao: 'exato', tusd_fio_b_real: concFioBManual };
  }
  return { precisao: 'estimado', tusd_fio_b_real: null };
}

// ── Match ANEEL agent to concessionária ──────────────────────────────────────

function matchAgentToConc(
  agenteSig: string,
  agenteNom: string,
  conc: { nome: string; sigla: string | null },
): boolean {
  const concSiglaNorm = normalizeStr(conc.sigla);
  const concNomeNorm = normalizeStr(conc.nome);
  const agSigNorm = normalizeStr(agenteSig);
  const agNomNorm = normalizeStr(agenteNom);

  if (concSiglaNorm && agSigNorm && agSigNorm === concSiglaNorm) return true;

  if (conc.sigla) {
    const aliases = SIGLA_ALIASES[conc.sigla.toUpperCase()] || [];
    for (const alias of aliases) {
      const aliasNorm = normalizeStr(alias);
      if (aliasNorm && (agSigNorm === aliasNorm || agNomNorm === aliasNorm)) return true;
      if (aliasNorm.length >= 3 && (agSigNorm.includes(aliasNorm) || aliasNorm.includes(agSigNorm))) return true;
      if (aliasNorm.length >= 3 && (agNomNorm.includes(aliasNorm) || aliasNorm.includes(agNomNorm))) return true;
    }
  }

  if (agNomNorm && concNomeNorm && agNomNorm === concNomeNorm) return true;

  const strippedConc = stripSuffixes(concNomeNorm);
  const strippedAgSig = stripSuffixes(agSigNorm);
  const strippedAgNom = stripSuffixes(agNomNorm);
  if (strippedConc.length >= 3) {
    if (strippedConc === strippedAgSig || strippedConc === strippedAgNom) return true;
    if (strippedAgSig.length >= 3 && (strippedConc.includes(strippedAgSig) || strippedAgSig.includes(strippedConc))) return true;
    if (strippedAgNom.length >= 3 && (strippedConc.includes(strippedAgNom) || strippedAgNom.includes(strippedConc))) return true;
  }

  if (concSiglaNorm && concSiglaNorm.length >= 2) {
    if (agSigNorm.includes(concSiglaNorm) || concSiglaNorm.includes(agSigNorm)) return true;
  }

  return false;
}

function findTarifaForConc(
  conc: { nome: string; sigla: string | null },
  porAgente: Record<string, TarifaAneel>,
  porNome: Record<string, TarifaAneel>,
): TarifaAneel | undefined {
  if (conc.sigla) {
    const t = porAgente[normalizeStr(conc.sigla)];
    if (t) return t;
  }
  if (conc.sigla) {
    for (const alias of (SIGLA_ALIASES[conc.sigla.toUpperCase()] || [])) {
      const norm = normalizeStr(alias);
      const t = porAgente[norm] || porNome[norm];
      if (t) return t;
    }
  }
  const t3 = porNome[normalizeStr(conc.nome)];
  if (t3) return t3;

  const stripped = stripSuffixes(normalizeStr(conc.nome));
  if (stripped.length >= 3) {
    for (const [k, v] of Object.entries(porAgente)) {
      const sk = stripSuffixes(k);
      if (sk.length >= 3 && (stripped.includes(sk) || sk.includes(stripped))) return v;
    }
    for (const [k, v] of Object.entries(porNome)) {
      const sk = stripSuffixes(k);
      if (sk.length >= 3 && (stripped.includes(sk) || sk.includes(stripped))) return v;
    }
  }
  if (conc.sigla) {
    const siglaNorm = normalizeStr(conc.sigla);
    if (siglaNorm.length >= 2) {
      for (const [k, v] of Object.entries(porAgente)) {
        if (k.includes(siglaNorm) || siglaNorm.includes(k)) return v;
      }
    }
  }
  return undefined;
}

// ── Fetch ANEEL API with pagination ──────────────────────────────────────────

async function fetchWithRetry(url: string, log: (msg: string) => void, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return response;
      log(`⚠️ ANEEL API tentativa ${attempt}/${maxRetries}: HTTP ${response.status}`);
      if (attempt === maxRetries) throw new Error(`Erro na API ANEEL: HTTP ${response.status}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error("Falha ao conectar com API ANEEL");
}

async function fetchAneelRecords(
  filters: Record<string, string>,
  log: (msg: string) => void,
  limit = 500,
): Promise<TarifaAneel[]> {
  const allRecords: TarifaAneel[] = [];
  let offset = 0;
  const maxPages = 10;

  for (let page = 0; page < maxPages; page++) {
    const filtersStr = JSON.stringify(filters);
    const url = `${ANEEL_API_URL}?resource_id=${ANEEL_RESOURCE_ID}&filters=${encodeURIComponent(filtersStr)}&q=&limit=${limit}&offset=${offset}&sort=DatInicioVigencia desc`;
    const response = await fetchWithRetry(url, log);
    const data = await response.json();
    if (!data.success || !data.result?.records) throw new Error("Resposta inesperada da API ANEEL");
    const records = data.result.records as TarifaAneel[];
    allRecords.push(...records);
    if (records.length < limit) break;
    offset += limit;
  }

  const minDate = `${MIN_VIGENCIA_YEAR}-01-01`;
  return allRecords.filter(r => r.DatInicioVigencia && r.DatInicioVigencia.substring(0, 10) >= minDate);
}

// ── Group A aggregation ──────────────────────────────────────────────────────

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
}

function aggregateGrupoARecords(records: TarifaAneel[]): GrupoATarifaAgregada[] {
  const grouped = new Map<string, TarifaAneel[]>();

  for (const r of records) {
    if (!r.DscBaseTarifaria || !r.DscBaseTarifaria.toLowerCase().includes("aplica")) continue;
    const key = `${normalizeStr(r.SigAgente)}|${normalizeStr(r.NomAgente)}|${normalizeStr(r.DscSubGrupo)}|${normalizeStr(r.DscModalidadeTarifaria)}|${r.DatInicioVigencia}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  const result: GrupoATarifaAgregada[] = [];

  for (const [, recs] of grouped) {
    const ref = recs[0];
    let te_ponta = 0, tusd_ponta = 0, te_fora_ponta = 0, tusd_fora_ponta = 0;

    for (const r of recs) {
      const posto = normalizeStr(r.NomPostoTarifario);
      const tusd = parseFloat(r.VlrTUSD) || 0;
      const te = parseFloat(r.VlrTE) || 0;
      const tusdKwh = Math.round(tusd / 1000 * 1000000) / 1000000;
      const teKwh = Math.round(te / 1000 * 1000000) / 1000000;

      if (posto.includes("PONTA") && !posto.includes("FORA")) {
        te_ponta = teKwh;
        tusd_ponta = tusdKwh;
      } else if (posto.includes("FORA")) {
        te_fora_ponta = teKwh;
        tusd_fora_ponta = tusdKwh;
      }
    }

    if (te_ponta > 0 || tusd_ponta > 0 || te_fora_ponta > 0 || tusd_fora_ponta > 0) {
      result.push({
        sigAgente: ref.SigAgente,
        nomAgente: ref.NomAgente,
        subgrupo: ref.DscSubGrupo,
        modalidade: ref.DscModalidadeTarifaria,
        te_ponta, tusd_ponta, te_fora_ponta, tusd_fora_ponta,
        vigencia_inicio: ref.DatInicioVigencia?.substring(0, 10) || new Date().toISOString().substring(0, 10),
      });
    }
  }

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

// ── Chunked upsert helper ────────────────────────────────────────────────────

async function chunkedUpsert(
  supabase: ReturnType<typeof createClient>,
  table: string,
  records: any[],
  onConflict: string,
  log: (msg: string) => void,
): Promise<{ ok: number; errors: number }> {
  let ok = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += DB_BATCH_SIZE) {
    const batch = records.slice(i, i + DB_BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) {
      log(`⚠️ Erro batch ${table} [${i}-${i + batch.length}]: ${error.message}`);
      errors += batch.length;
    } else {
      ok += batch.length;
    }
  }

  return { ok, errors };
}

// ── Background processor ─────────────────────────────────────────────────────

async function processSync(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  tenantId: string,
  userId: string | null,
  concessionariaId: string | null,
  triggerType: string,
  testRun: boolean,
) {
  const runLogs: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString().substring(11, 19)}] ${msg}`;
    console.log(line);
    runLogs.push(line);
  };

  let totalUpdated = 0;
  let totalMatched = 0;
  let totalFetched = 0;
  let totalErrors = 0;
  let lastFlush = Date.now();

  const flushProgress = async (force = false) => {
    if (!force && Date.now() - lastFlush < 3000) return;
    lastFlush = Date.now();
    try {
      await supabase.from('aneel_sync_runs').update({
        logs: runLogs,
        total_fetched: totalFetched,
        total_matched: totalMatched,
        total_updated: totalUpdated,
        total_errors: totalErrors,
      }).eq('id', runId);
    } catch {}
  };

  // ── GUARANTEED FINALIZATION wrapper ────────────────────────────────────
  // No matter what happens, the run will always get a final status.
  let finalStatus = 'error';
  let errorMsg: string | null = null;

  try {
    log(`Sync v7.0 iniciado — tenant=${tenantId.substring(0, 8)}…, trigger=${testRun ? 'test_run' : triggerType}`);
    if (testRun) log("🧪 MODO TEST RUN — nenhuma alteração será publicada");

    // ── Step 1: Fetch concessionárias ─────────────────────────────────────
    let query = supabase.from('concessionarias')
      .select('id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, aliquota_icms, pis_percentual, cofins_percentual, possui_isencao_scee, percentual_isencao')
      .eq('tenant_id', tenantId)
      .eq('ativo', true);

    if (concessionariaId) query = query.eq('id', concessionariaId);
    const { data: concessionarias, error: concError } = await query;
    if (concError) throw concError;

    log(`📋 ${concessionarias?.length || 0} concessionária(s) ativas`);

    if (!concessionarias || concessionarias.length === 0) {
      finalStatus = 'success';
      return;
    }

    // ── Step 1b: Fetch state tax config for auto-fill ──────────────────────
    const { data: estadoTributos } = await supabase
      .from('config_tributaria_estado')
      .select('estado, aliquota_icms, possui_isencao_scee, percentual_isencao');

    const tributoPorEstado: Record<string, { aliquota_icms: number; possui_isencao_scee: boolean; percentual_isencao: number }> = {};
    for (const t of (estadoTributos || [])) {
      tributoPorEstado[t.estado] = { aliquota_icms: t.aliquota_icms, possui_isencao_scee: t.possui_isencao_scee, percentual_isencao: t.percentual_isencao };
    }
    log(`🏛️ ${Object.keys(tributoPorEstado).length} estados com config tributária`);

    // ── Step 2: Create tarifa_versoes (draft) ─────────────────────────────
    let versaoId: string | null = null;
    if (!testRun) {
      const { data: versao, error: versaoError } = await supabase
        .from('tarifa_versoes')
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          origem: 'sync',
          status: 'rascunho',
          notas: `Sync ANEEL automático — run ${runId.substring(0, 8)}`,
          sync_run_id: runId,
        })
        .select('id')
        .single();

      if (versaoError) {
        log(`⚠️ Erro ao criar tarifa_versoes: ${versaoError.message}`);
        throw versaoError;
      }
      versaoId = versao.id;
      log(`📦 Versão rascunho criada: ${versaoId!.substring(0, 8)}…`);
    }

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 1: BT (B1, B2, B3)
    // ══════════════════════════════════════════════════════════════════════

    log("═══ FASE 1: Tarifas BT ═══");

    const BT_SUBGRUPOS = ['B1', 'B2', 'B3'];
    const btRecordsBySubgrupo: Record<string, TarifaAneel[]> = {};
    let allBtRecords: TarifaAneel[] = [];

    for (const sub of BT_SUBGRUPOS) {
      try {
        const records = await fetchAneelRecords({
          DscSubGrupo: sub,
          DscModalidadeTarifaria: "Convencional",
          DscDetalhe: "Não se aplica",
          DscBaseTarifaria: "Tarifa de Aplicação",
        }, log);
        btRecordsBySubgrupo[sub] = records;
        allBtRecords.push(...records);
        log(`📡 BT ${sub}: ${records.length} registros`);
      } catch (err) {
        log(`⚠️ Erro BT ${sub}: ${err instanceof Error ? err.message : String(err)}`);
        btRecordsBySubgrupo[sub] = [];
      }
    }

    totalFetched = allBtRecords.length;
    const snapshotHash = await sha256(JSON.stringify(allBtRecords.slice(0, 100)));
    log(`BT total: ${allBtRecords.length} registros`);
    await flushProgress(true);

    // Build lookup indexes per subgrupo — EXCLUDE Tarifa Social records
    // When two records share the same vigência, prefer non-Social over Social.
    const btIndexBySubgrupo: Record<string, { porAgente: Record<string, TarifaAneel>; porNome: Record<string, TarifaAneel> }> = {};
    for (const sub of BT_SUBGRUPOS) {
      const porAgente: Record<string, TarifaAneel> = {};
      const porNome: Record<string, TarifaAneel> = {};
      for (const t of (btRecordsBySubgrupo[sub] || [])) {
        const isSocial = isTarifaSocial(t);
        // Always prefer non-Social; if both are same type, prefer latest vigência
        const shouldReplace = (existing: TarifaAneel | undefined): boolean => {
          if (!existing) return true;
          const existingIsSocial = isTarifaSocial(existing);
          // Non-social always beats social
          if (existingIsSocial && !isSocial) return true;
          // Social never beats non-social
          if (!existingIsSocial && isSocial) return false;
          // Same type: prefer latest vigência
          return t.DatInicioVigencia > existing.DatInicioVigencia;
        };
        if (t.SigAgente) {
          const k = normalizeStr(t.SigAgente);
          if (shouldReplace(porAgente[k])) porAgente[k] = t;
        }
        if (t.NomAgente) {
          const k = normalizeStr(t.NomAgente);
          if (shouldReplace(porNome[k])) porNome[k] = t;
        }
      }
      btIndexBySubgrupo[sub] = { porAgente, porNome };
    }

    const uniqueAgents = new Set<string>();
    for (const t of allBtRecords) uniqueAgents.add(`${t.SigAgente} | ${t.NomAgente}`);
    log(`📊 ${uniqueAgents.size} agentes distintos na API ANEEL`);

    const tarifasPorAgente = btIndexBySubgrupo['B1']?.porAgente || {};
    const tarifasPorNome = btIndexBySubgrupo['B1']?.porNome || {};

    // Process BT for each concessionária — collect all upserts first, then batch write
    const erros: { concessionaria: string; erro: string }[] = [];
    const matchedConcs: string[] = [];
    const unmatchedConcs: string[] = [];
    const allBtUpserts: any[] = [];
    const allTvInserts: any[] = [];
    const concUpdates: Array<{ id: string; tarifa_energia: number; tarifa_fio_b: number }> = [];

    for (const conc of concessionarias) {
      const tarifa = findTarifaForConc(conc, tarifasPorAgente, tarifasPorNome);

      if (!tarifa) {
        log(`❌ NÃO MATCH: ${conc.nome} (sigla=${conc.sigla || '?'}, estado=${conc.estado || '?'})`);
        unmatchedConcs.push(conc.nome);
        erros.push({ concessionaria: conc.nome, erro: `BT: Não encontrada na ANEEL` });
        totalErrors++;
        continue;
      }

      matchedConcs.push(`${conc.nome} ← ${tarifa.SigAgente}`);
      totalMatched++;

      const tusdMwh = parseFloat(tarifa.VlrTUSD) || 0;
      const teMwh = parseFloat(tarifa.VlrTE) || 0;
      const tusdTotal = Math.round(tusdMwh / 1000 * 1000000) / 1000000;
      const te = Math.round(teMwh / 1000 * 1000000) / 1000000;
      const tarifaTotal = Math.round((tusdTotal + te) * 1000000) / 1000000;

      const { status: validStatus, notes: validNotes } = validateTariffRecord(te, tusdTotal);
      const { precisao, tusd_fio_b_real } = detectPrecisao(conc.tarifa_fio_b, tusdTotal);
      const recordHash = await sha256(JSON.stringify(tarifa));
      const vigenciaInicio = tarifa.DatInicioVigencia ? tarifa.DatInicioVigencia.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const vigenciaFim = tarifa.DatFimVigencia && tarifa.DatFimVigencia !== '0001-01-01' ? tarifa.DatFimVigencia.substring(0, 10) : null;

      if (!testRun) {
        // Collect tariff_versions insert
        allTvInserts.push({
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

        // Collect concessionaria update
        // FIX: tarifa_energia = TE only (not combined total) to avoid double-counting
        // when UI computes integral = (tarifa_energia + tarifa_fio_b) / (1 - tributos)
        concUpdates.push({
          id: conc.id,
          tarifa_energia: te,
          tarifa_fio_b: tusd_fio_b_real ?? tusdTotal,
        });

        // Collect BT subgrupo upserts — ALL with versao_id
        for (const sub of BT_SUBGRUPOS) {
          const subIndex = btIndexBySubgrupo[sub];
          if (!subIndex) continue;
          const subTarifa = findTarifaForConc(conc, subIndex.porAgente, subIndex.porNome);
          const srcTarifa = subTarifa || tarifa;
          const subTusdMwh = parseFloat(srcTarifa.VlrTUSD) || 0;
          const subTeMwh = parseFloat(srcTarifa.VlrTE) || 0;
          const subTusd = Math.round(subTusdMwh / 1000 * 1000000) / 1000000;
          const subTe = Math.round(subTeMwh / 1000 * 1000000) / 1000000;
          const subTotal = Math.round((subTusd + subTe) * 1000000) / 1000000;
          const { tusd_fio_b_real: subFioB } = detectPrecisao(conc.tarifa_fio_b, subTusd);

          allBtUpserts.push({
            concessionaria_id: conc.id,
            tenant_id: tenantId,
            subgrupo: sub,
            modalidade_tarifaria: 'Convencional',
            tarifa_energia: subTe,  // FIX: TE only, not combined total
            tarifa_fio_b: subFioB ?? subTusd,
            origem: subTarifa ? 'ANEEL' : 'ANEEL (fallback B1)',
            is_active: true,
            versao_id: versaoId,
            vigencia_inicio: vigenciaInicio,
            updated_at: new Date().toISOString(),
          });
        }

        totalUpdated++;
        log(`✅ BT ${conc.nome} → TE=${te.toFixed(4)} TUSD=${tusdTotal.toFixed(4)} Total=${tarifaTotal.toFixed(4)} R$/kWh (${tarifa.SigAgente}) [${tarifa.DscSubClasse || 'N/A'}]`);
      } else {
        log(`🧪 BT ${conc.nome} → TE=${te.toFixed(4)} TUSD=${tusdTotal.toFixed(4)} Total=${tarifaTotal.toFixed(4)} (${tarifa.SigAgente}) [${tarifa.DscSubClasse || 'N/A'}]`);
        totalUpdated++;
      }
      await flushProgress();
    }

    log(`📊 BT Resumo: ${matchedConcs.length} matched, ${unmatchedConcs.length} não encontradas`);
    if (unmatchedConcs.length > 0) log(`❌ Sem correspondência: ${unmatchedConcs.join(', ')}`);

    // ── Chunked writes for BT ──────────────────────────────────────────────
    if (!testRun) {
      // 1) Deactivate old tariff_versions for matched concs
      const matchedConcIds = concUpdates.map(c => c.id);
      if (matchedConcIds.length > 0) {
        await supabase.from('tariff_versions')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('concessionaria_id', matchedConcIds);
      }

      // 2) Insert tariff_versions in chunks
      if (allTvInserts.length > 0) {
        const tvResult = await chunkedUpsert(supabase, 'tariff_versions', allTvInserts, 'id', log);
        log(`📝 tariff_versions: ${tvResult.ok} inseridos, ${tvResult.errors} erros`);
        totalErrors += tvResult.errors;
      }

      // 3) Upsert BT subgrupos in chunks
      if (allBtUpserts.length > 0) {
        const btResult = await chunkedUpsert(supabase, 'concessionaria_tarifas_subgrupo', allBtUpserts,
          'tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria', log);
        log(`📝 BT subgrupos: ${btResult.ok} ok, ${btResult.errors} erros`);
        totalErrors += btResult.errors;
      }

      // 4) Update concessionaria main records + auto-fill taxes
      const PIS_DEFAULT = 1.65;
      const COFINS_DEFAULT = 7.60;
      let taxAutoFilled = 0;

      for (const conc of concessionarias) {
        const upd = concUpdates.find(u => u.id === conc.id);
        if (!upd) continue;

        const updatePayload: Record<string, any> = {
          tarifa_energia: upd.tarifa_energia,
          tarifa_fio_b: upd.tarifa_fio_b,
          ultima_sync_tarifas: new Date().toISOString(),
        };

        // Auto-fill PIS/COFINS if missing
        if (conc.pis_percentual == null || conc.pis_percentual === 0) {
          updatePayload.pis_percentual = PIS_DEFAULT;
        }
        if (conc.cofins_percentual == null || conc.cofins_percentual === 0) {
          updatePayload.cofins_percentual = COFINS_DEFAULT;
        }

        // Auto-fill ICMS from state config if missing
        if (conc.aliquota_icms == null && conc.estado && tributoPorEstado[conc.estado]) {
          updatePayload.aliquota_icms = tributoPorEstado[conc.estado].aliquota_icms;
        }

        // Auto-fill isenção SCEE from state config if null
        if (conc.possui_isencao_scee == null && conc.estado && tributoPorEstado[conc.estado]) {
          updatePayload.possui_isencao_scee = tributoPorEstado[conc.estado].possui_isencao_scee;
          updatePayload.percentual_isencao = tributoPorEstado[conc.estado].percentual_isencao;
        }

        const hasAutoFill = updatePayload.pis_percentual || updatePayload.cofins_percentual || updatePayload.aliquota_icms !== undefined || updatePayload.possui_isencao_scee !== undefined;
        if (hasAutoFill) taxAutoFilled++;

        await supabase.from('concessionarias').update(updatePayload).eq('id', upd.id);
      }

      if (taxAutoFilled > 0) {
        log(`🏛️ ${taxAutoFilled} concessionária(s) com impostos auto-preenchidos (ICMS/PIS/COFINS/isenção)`);
      }
    }

    await flushProgress(true);

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 2: Grupo A (MT) — PARALLEL API calls
    // ══════════════════════════════════════════════════════════════════════

    log("═══ FASE 2: Tarifas MT (Grupo A) — Paralelo ═══");

    const MT_SUBGRUPOS = ['A4', 'A3a', 'A3', 'A2', 'A1', 'AS'];
    const MT_MODALIDADES = ['Azul', 'Verde'];
    const allMtRecords: TarifaAneel[] = [];

    const mtCalls: Array<{ subgrupo: string; modalidade: string }> = [];
    for (const subgrupo of MT_SUBGRUPOS) {
      for (const modalidade of MT_MODALIDADES) {
        mtCalls.push({ subgrupo, modalidade });
      }
    }

    const MT_PARALLEL = 3;
    for (let i = 0; i < mtCalls.length; i += MT_PARALLEL) {
      const batch = mtCalls.slice(i, i + MT_PARALLEL);
      const results = await Promise.allSettled(
        batch.map(({ subgrupo, modalidade }) =>
          fetchAneelRecords({
            DscSubGrupo: subgrupo,
            DscModalidadeTarifaria: modalidade,
            DscBaseTarifaria: "Tarifa de Aplicação",
          }, log, 500)
        )
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        const { subgrupo, modalidade } = batch[j];
        if (r.status === 'fulfilled' && r.value.length > 0) {
          allMtRecords.push(...r.value);
          log(`📡 MT ${subgrupo}/${modalidade}: ${r.value.length}`);
        } else if (r.status === 'rejected') {
          log(`⚠️ MT ${subgrupo}/${modalidade}: erro`);
        }
      }
      await flushProgress();
    }

    totalFetched = allBtRecords.length + allMtRecords.length;
    log(`MT total: ${allMtRecords.length} registros brutos`);
    await flushProgress(true);

    let totalMtUpdated = 0;
    let totalMtMatched = 0;

    if (allMtRecords.length > 0) {
      const aggregated = aggregateGrupoARecords(allMtRecords);
      log(`MT agregado: ${aggregated.length} combinações únicas`);

      // Pre-fetch manual records to protect them
      const concIds = concessionarias.map(c => c.id);
      const { data: existingManual } = await supabase
        .from('concessionaria_tarifas_subgrupo')
        .select('concessionaria_id, subgrupo, modalidade_tarifaria')
        .eq('tenant_id', tenantId)
        .eq('origem', 'manual')
        .in('concessionaria_id', concIds);

      const manualKeys = new Set(
        (existingManual || []).map(r => `${r.concessionaria_id}|${r.subgrupo}|${r.modalidade_tarifaria}`)
      );
      if (manualKeys.size > 0) log(`🔒 ${manualKeys.size} registros manuais protegidos`);

      const mtUpsertsMap = new Map<string, any>();

      for (const conc of concessionarias) {
        const concMtTarifas = aggregated.filter(a =>
          matchAgentToConc(a.sigAgente, a.nomAgente, conc)
        );

        if (concMtTarifas.length === 0) continue;
        totalMtMatched++;

        for (const mt of concMtTarifas) {
          const upsertKey = `${conc.id}|${mt.subgrupo}|${mt.modalidade}`;
          if (manualKeys.has(upsertKey)) continue;

          const existing = mtUpsertsMap.get(upsertKey);
          if (existing && existing.vigencia_inicio >= mt.vigencia_inicio) continue;

          mtUpsertsMap.set(upsertKey, {
            concessionaria_id: conc.id,
            tenant_id: tenantId,
            subgrupo: mt.subgrupo,
            modalidade_tarifaria: mt.modalidade,
            te_ponta: mt.te_ponta,
            te_fora_ponta: mt.te_fora_ponta,
            tusd_ponta: mt.tusd_ponta,
            tusd_fora_ponta: mt.tusd_fora_ponta,
            vigencia_inicio: mt.vigencia_inicio,
            origem: 'ANEEL',
            is_active: true,
            versao_id: versaoId,
            updated_at: new Date().toISOString(),
          });
        }
      }

      const mtUpserts = Array.from(mtUpsertsMap.values());
      log(`MT deduplicado: ${mtUpserts.length} registros únicos`);

      if (!testRun && mtUpserts.length > 0) {
        const mtResult = await chunkedUpsert(
          supabase, 'concessionaria_tarifas_subgrupo', mtUpserts,
          'tenant_id,concessionaria_id,subgrupo,modalidade_tarifaria', log
        );
        totalMtUpdated = mtResult.ok;
        totalErrors += mtResult.errors;
        log(`✅ MT: ${totalMtUpdated} subgrupos atualizados, ${mtResult.errors} erros`);
      } else if (testRun) {
        totalMtUpdated = mtUpserts.length;
        log(`🧪 MT: ${mtUpserts.length} subgrupos simulados`);
      }
    }

    totalMatched += totalMtMatched;
    totalUpdated += totalMtUpdated;

    // ══════════════════════════════════════════════════════════════════════
    // PHASE 3: Activate version (governance)
    // ══════════════════════════════════════════════════════════════════════

    if (!testRun && versaoId) {
      // Check for TE/TUSD = 0 in BT records only.
      // MT records legitimately have tarifa_energia=0 because they use te_ponta/tusd_ponta fields.
      const { data: zeroCheck } = await supabase
        .from('concessionaria_tarifas_subgrupo')
        .select('id')
        .eq('versao_id', versaoId)
        .like('subgrupo', 'B%')
        .or('tarifa_energia.eq.0,tarifa_fio_b.eq.0')
        .limit(1);

      const hasZeros = (zeroCheck?.length || 0) > 0;

      if (hasZeros) {
        log(`⚠️ GOVERNANÇA: Versão NÃO ativada — detectados valores TE/TUSD = 0`);
        // Keep as rascunho but update counts
        await supabase.from('tarifa_versoes').update({
          total_registros: totalUpdated + totalMtUpdated,
          total_concessionarias: totalMatched,
          notas: `Sync ANEEL — NÃO ATIVADA (valores zero detectados). Run: ${runId.substring(0, 8)}`,
        }).eq('id', versaoId);
        finalStatus = 'partial';
      } else if (totalUpdated === 0 && totalMtUpdated === 0) {
        log(`⚠️ Nenhum registro atualizado — versão mantida como rascunho`);
        finalStatus = totalErrors > 0 ? 'error' : 'success';
      } else {
        // Deactivate previous active version
        await supabase.from('tarifa_versoes')
          .update({ status: 'arquivada' })
          .eq('tenant_id', tenantId)
          .eq('status', 'ativa')
          .neq('id', versaoId);

        // Activate this version
        await supabase.from('tarifa_versoes').update({
          status: 'ativa',
          activated_at: new Date().toISOString(),
          activated_by: userId,
          total_registros: totalUpdated + totalMtUpdated,
          total_concessionarias: totalMatched,
          notas: `Sync ANEEL ativada automaticamente. Run: ${runId.substring(0, 8)}`,
        }).eq('id', versaoId);

        log(`✅ GOVERNANÇA: Versão ${versaoId.substring(0, 8)}… ATIVADA com ${totalUpdated + totalMtUpdated} registros`);
        finalStatus = erros.length === 0 ? 'success' : 'partial';
      }
    } else if (testRun) {
      finalStatus = 'test_run';
    }

    // ── Finalize ──────────────────────────────────────────────────────────
    log(`════════════════════════════════`);
    log(`✅ CONCLUÍDO — BT: ${totalUpdated - totalMtUpdated} concs, MT: ${totalMtUpdated} subgrupos, Erros: ${totalErrors}`);
    log(`Status: ${finalStatus}`);

  } catch (error) {
    console.error("[sync-tarifas-aneel] Erro:", error);
    errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
    finalStatus = 'error';
    log(`💥 ERRO FATAL: ${errorMsg}`);
  } finally {
    // ── GUARANTEED status update ────────────────────────────────────────
    try {
      await supabase.from('aneel_sync_runs').update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        error_message: errorMsg,
        total_fetched: totalFetched,
        total_matched: totalMatched,
        total_updated: totalUpdated,
        total_errors: totalErrors,
        snapshot_hash: '',
        logs: runLogs,
      }).eq('id', runId);
    } catch (finalErr) {
      console.error("[sync-tarifas-aneel] CRITICAL: Failed to finalize run status:", finalErr);
    }
  }
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
      return new Response(JSON.stringify({ success: false, error: 'Tenant não encontrado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for already running sync — 5 min stale threshold
    const { data: activeRun } = await supabase
      .from('aneel_sync_runs')
      .select('id, started_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRun) {
      const startedAt = new Date(activeRun.started_at).getTime();
      if (Date.now() - startedAt < 5 * 60 * 1000) {
        return new Response(JSON.stringify({
          success: true, run_id: activeRun.id,
          message: 'Sincronização já em andamento. Acompanhe o progresso.',
          already_running: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Mark stale
      await supabase.from('aneel_sync_runs').update({
        status: 'timed_out',
        finished_at: new Date().toISOString(),
        error_message: 'Execução expirou (timeout > 5min)',
      }).eq('id', activeRun.id);
    }

    let concessionariaId: string | null = null;
    let triggerType = 'manual';
    let testRun = false;
    try {
      const body = await req.json();
      concessionariaId = body?.concessionaria_id || null;
      triggerType = body?.trigger_type || 'manual';
      testRun = body?.test_run === true;
    } catch {}

    // Create run record
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

    // 🚀 AWAIT sync — must keep isolate alive until completion
    // Supabase kills the isolate shortly after returning a response,
    // so we MUST await here. The UI polls aneel_sync_runs for progress.
    try {
      await processSync(supabase, runId, tenantId, userId, concessionariaId, triggerType, testRun);
    } catch (syncErr: any) {
      console.error("[sync-tarifas-aneel] Sync error:", syncErr);
      // processSync already finalizes the run status internally,
      // so we just log here
    }

    // Fetch final status to return
    const { data: finalRun } = await supabase
      .from('aneel_sync_runs')
      .select('status, total_fetched, total_matched, total_updated, total_errors, error_message')
      .eq('id', runId)
      .single();

    return new Response(JSON.stringify({
      success: finalRun?.status === 'success' || finalRun?.status === 'partial',
      run_id: runId,
      status: finalRun?.status || 'unknown',
      message: finalRun?.status === 'success' 
        ? `Sincronização concluída: ${finalRun.total_updated} registros atualizados`
        : finalRun?.error_message || 'Sincronização finalizada',
      total_fetched: finalRun?.total_fetched || 0,
      total_matched: finalRun?.total_matched || 0,
      total_updated: finalRun?.total_updated || 0,
      total_errors: finalRun?.total_errors || 0,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[sync-tarifas-aneel] Handler error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Erro interno",
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
