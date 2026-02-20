// ──────────────────────────────────────────────────────────────────────────────
// sync-tarifas-aneel v3.0 — ANEEL Tariff Sync with precision tracking
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
    .eq('id', userId)
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

function validateTariffRecord(te: number, tusdTotal: number, concNome: string): {
  status: ValidationStatus;
  notes: string[];
} {
  const notes: string[] = [];

  if (te <= 0) notes.push("TE negativa ou zero — dado suspeito");
  if (tusdTotal < 0) notes.push("TUSD negativo — dado suspeito");
  if (te > 2.0) notes.push(`TE muito alta (${te.toFixed(4)} R$/kWh) — verificar unidade`);
  if (tusdTotal > 2.0) notes.push(`TUSD muito alto (${tusdTotal.toFixed(4)} R$/kWh) — verificar unidade`);
  if (te + tusdTotal > 3.0) notes.push("Tarifa total > R$ 3,00/kWh — possível erro de unidade");

  const hasGd3Data = false; // Future: detect Fio A, TFSEE, P&D from ANEEL
  const status: ValidationStatus =
    notes.some(n => n.includes("suspeito") || n.includes("erro")) ? 'atencao' :
    !hasGd3Data ? 'incompleto_gd3' : 'ok';

  return { status, notes };
}

// ── Precision detection ───────────────────────────────────────────────────────

/**
 * ANEEL API returns VlrTUSD which is the TOTAL TUSD, not the Fio B component.
 * Real Fio B (distribution wire cost only) is NOT available from the standard
 * B1-Conventional endpoint. So all syncs from this API are ESTIMADO precision.
 *
 * When a concessionária has tusd_fio_b manually set (from the admin panel),
 * we check if it differs from TUSD total — if so, real Fio B is available → EXATO.
 */
function detectPrecisao(concFioBManual: number | null, tusdTotalAneel: number): {
  precisao: 'exato' | 'estimado';
  tusd_fio_b_real: number | null;
} {
  // If the concessionária has a manually-set Fio B that differs from TUSD total
  if (concFioBManual != null && concFioBManual > 0 && Math.abs(concFioBManual - tusdTotalAneel) > 0.000001) {
    return { precisao: 'exato', tusd_fio_b_real: concFioBManual };
  }
  // Otherwise, TUSD total is used as proxy → ESTIMADO
  return { precisao: 'estimado', tusd_fio_b_real: null };
}

// ── Match ANEEL record to concessionária ─────────────────────────────────────

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

    log(`Sync iniciado — tenant=${tenantId}, trigger=${testRun ? 'test_run' : triggerType}, runId=${runId}`);
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

    // ── Fetch ANEEL data ──────────────────────────────────────────────────────
    const filters = JSON.stringify({
      DscSubGrupo: "B1",
      DscModalidadeTarifaria: "Convencional",
      DscDetalhe: "Não se aplica",
      DscBaseTarifaria: "Tarifa de Aplicação",
    });
    const aneelUrl = `${ANEEL_API_URL}?resource_id=${ANEEL_RESOURCE_ID}&filters=${encodeURIComponent(filters)}&limit=500&sort=DatInicioVigencia desc`;

    log("Consultando API ANEEL...");
    const response = await fetch(aneelUrl);

    if (!response.ok) {
      const errText = await response.text();
      log(`ERRO API ANEEL: ${response.status} — ${errText.substring(0, 200)}`);
      await supabase.from('aneel_sync_runs').update({
        status: 'error', finished_at: new Date().toISOString(),
        logs: runLogs, error_message: `API ANEEL error ${response.status}`,
      }).eq('id', runId);
      return new Response(JSON.stringify({ success: false, error: `ANEEL API ${response.status}`, run_id: runId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aneelData = await response.json();
    if (!aneelData.success || !aneelData.result?.records) {
      throw new Error("Resposta inesperada da API ANEEL");
    }

    const tarifas: TarifaAneel[] = aneelData.result.records;
    const snapshotHash = await sha256(JSON.stringify(tarifas));
    log(`ANEEL retornou ${tarifas.length} registros — hash=${snapshotHash.substring(0, 16)}...`);

    // ── Build lookup indexes ──────────────────────────────────────────────────
    const tarifasPorAgente: Record<string, TarifaAneel> = {};
    const tarifasPorNome: Record<string, TarifaAneel> = {};
    for (const t of tarifas) {
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

    // ── Process each concessionária ───────────────────────────────────────────
    const resultados: object[] = [];
    const erros: { concessionaria: string; erro: string }[] = [];
    let totalUpdated = 0;
    let totalMatched = 0;

    for (const conc of concessionarias) {
      const tarifa = findTarifaForConc(conc, tarifasPorAgente, tarifasPorNome);

      if (!tarifa) {
        log(`⚠️ NÃO ENCONTRADO: ${conc.nome} (sigla=${conc.sigla || '?'})`);
        erros.push({ concessionaria: conc.nome, erro: `Não encontrada na ANEEL. Sigla: "${conc.sigla || ''}"` });
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

      // Detect precision: real Fio B (manual) vs TUSD total (ANEEL proxy)
      const { precisao, tusd_fio_b_real } = detectPrecisao(conc.tarifa_fio_b, tusdTotal);

      const recordHash = await sha256(JSON.stringify(tarifa));
      const vigenciaInicio = tarifa.DatInicioVigencia ? tarifa.DatInicioVigencia.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const vigenciaFim = tarifa.DatFimVigencia && tarifa.DatFimVigencia !== '0001-01-01' ? tarifa.DatFimVigencia.substring(0, 10) : null;

      const precLabel = precisao === 'exato' ? 'EXATO (Fio B real)' : 'ESTIMADO (TUSD total como proxy)';
      log(`📊 ${conc.nome} → TE=${te.toFixed(6)}, TUSD total=${tusdTotal.toFixed(6)}, FioB real=${tusd_fio_b_real?.toFixed(6) ?? 'N/A'} → ${precLabel}`);

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
          tusd_fio_b_kwh: tusd_fio_b_real, // only set when real Fio B is available
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

        totalUpdated++;
        log(`✅ ${conc.nome} → TE=${te.toFixed(6)} + TUSD=${tusdTotal.toFixed(6)} = ${tarifaTotal.toFixed(6)} R$/kWh | vigência=${vigenciaInicio} | ${precLabel} | auditoria=${validStatus}`);
      } else {
        log(`🧪 [DRY-RUN] ${conc.nome} → TE=${te.toFixed(6)} + TUSD=${tusdTotal.toFixed(6)} = ${tarifaTotal.toFixed(6)} | ${precLabel} | auditoria=${validStatus}`);
        totalUpdated++;
      }

      resultados.push({
        concessionaria: conc.nome,
        tarifa_anterior: conc.tarifa_energia,
        tarifa_nova: tarifaTotal,
        te,
        tusd_total: tusdTotal,
        tusd_fio_b_real: tusd_fio_b_real,
        precisao,
        vigencia: vigenciaInicio,
        validation_status: validStatus,
        validation_notes: validNotes,
        sincronizado: !testRun,
      });
    }

    // ── Finalize run ──────────────────────────────────────────────────────────
    const finalStatus = testRun ? 'test_run' :
      erros.length === 0 ? 'success' : totalUpdated > 0 ? 'partial' : 'error';
    await supabase.from('aneel_sync_runs').update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      total_fetched: tarifas.length,
      total_matched: totalMatched,
      total_updated: totalUpdated,
      total_errors: erros.length,
      snapshot_hash: snapshotHash,
      logs: runLogs,
    }).eq('id', runId);

    log(`Sync concluído: ${totalUpdated} ${testRun ? 'simuladas' : 'atualizadas'}, ${erros.length} erros. Status=${finalStatus}`);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      status: finalStatus,
      test_run: testRun,
      message: testRun
        ? `Test run: ${totalUpdated} concessionária(s) seriam atualizadas`
        : `Tarifas atualizadas para ${totalUpdated} concessionária(s)`,
      resultados,
      erros,
      fonte: "ANEEL - Dados Abertos (Tarifas Homologadas B1 Convencional)",
      total_aneel: tarifas.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error("[sync-tarifas-aneel] Erro:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
