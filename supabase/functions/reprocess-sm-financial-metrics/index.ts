/**
 * reprocess-sm-financial-metrics
 *
 * Wave 2.1 — Recalcula payback/TIR/VPL para propostas SolarMarket
 * com payback_meses NULL ou 0, usando o motor canônico calcFinancialSeries.
 *
 * Governança AGENTS.md v4.1:
 *  - RB-71: chunks <= 25
 *  - RB-75: logs estruturados (sem console.log por registro)
 *  - Não altera valor_total, status, cliente/projeto/deal.
 *  - Só preenche campos NULL/0 (FASE 2).
 *  - Apenas external_source='solarmarket'.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { calcFinancialSeries, type FinancialSeriesInput } from "./calcFinancialSeries.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  dryRun?: boolean;
  limit?: number;
  offset?: number;
}

interface SkipReason {
  versao_id: string;
  reason: string;
}

interface FixRecord {
  versao_id: string;
  tenant_id: string;
  before: { payback: number | null; tir: number | null; vpl: number | null };
  after: { payback: number; tir: number; vpl: number };
  applied: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const dryRun = body.dryRun !== false; // default true
    const limit = Math.min(Math.max(body.limit ?? 25, 1), 25); // RB-71 hard cap
    const offset = Math.max(body.offset ?? 0, 0);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar candidatos
    const { data: versoes, error: vErr } = await supa
      .from("proposta_versoes")
      .select(
        "id, tenant_id, proposta_id, valor_total, potencia_kwp, geracao_mensal, economia_mensal, payback_meses, tir, vpl, snapshot",
      )
      .or("payback_meses.is.null,payback_meses.eq.0")
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (vErr) throw vErr;

    // Filtrar apenas SM (via JOIN manual)
    const propostaIds = [...new Set((versoes ?? []).map((v) => v.proposta_id))];
    const { data: propostas } = await supa
      .from("propostas_nativas")
      .select("id, external_source")
      .in("id", propostaIds);

    const smPropostaIds = new Set(
      (propostas ?? [])
        .filter((p) => p.external_source === "solarmarket")
        .map((p) => p.id),
    );

    const targets = (versoes ?? []).filter((v) =>
      smPropostaIds.has(v.proposta_id)
    );

    const versaoIds = targets.map((t) => t.id);

    // Bulk fetch UCs
    const { data: ucs } = await supa
      .from("proposta_versao_ucs")
      .select(
        "versao_id, consumo_mensal_kwh, tarifa_energia, tarifa_fio_b, tipo_ligacao, grupo",
      )
      .in("versao_id", versaoIds);

    const ucsByVersao = new Map<string, typeof ucs>();
    for (const u of ucs ?? []) {
      const arr = ucsByVersao.get(u.versao_id) ?? [];
      arr.push(u);
      ucsByVersao.set(u.versao_id, arr);
    }

    const fixes: FixRecord[] = [];
    const skips: SkipReason[] = [];

    for (const v of targets) {
      const versaoUcs = ucsByVersao.get(v.id) ?? [];
      if (versaoUcs.length === 0) {
        skips.push({ versao_id: v.id, reason: "sem_uc" });
        continue;
      }

      const consumoTotal = versaoUcs.reduce(
        (s, u) => s + Number(u.consumo_mensal_kwh ?? 0),
        0,
      );
      const tarifaBase = versaoUcs.reduce(
        (s, u) => s + Number(u.tarifa_energia ?? 0),
        0,
      ) / versaoUcs.length;
      const tarifaFioB = versaoUcs.reduce(
        (s, u) => s + Number(u.tarifa_fio_b ?? 0),
        0,
      ) / versaoUcs.length;

      const valor = Number(v.valor_total ?? 0);
      const potencia = Number(v.potencia_kwp ?? 0);
      const geracao = Number(v.geracao_mensal ?? 0);

      if (!valor || !potencia || !geracao || !consumoTotal || !tarifaBase) {
        skips.push({
          versao_id: v.id,
          reason: !valor
            ? "sem_valor"
            : !potencia
            ? "sem_potencia"
            : !geracao
            ? "sem_geracao"
            : !consumoTotal
            ? "sem_consumo"
            : "sem_tarifa",
        });
        continue;
      }

      const fase = (versaoUcs[0].tipo_ligacao === "MT"
        ? "trifasico"
        : "bifasico") as "monofasico" | "bifasico" | "trifasico";

      const input: FinancialSeriesInput = {
        precoFinal: valor,
        potenciaKwp: potencia,
        irradiacao: 0, // usa geracaoMensalKwh diretamente
        geracaoMensalKwh: geracao,
        consumoTotal,
        tarifaBase,
        custoDisponibilidade: 0,
        tarifaFioB: tarifaFioB || undefined,
        fase,
        grupo: "B",
        regra: "GD2",
        premissas: null,
      };

      let out;
      try {
        out = calcFinancialSeries(input);
      } catch (e) {
        skips.push({
          versao_id: v.id,
          reason: `engine_error:${(e as Error).message}`,
        });
        continue;
      }

      // Sanity: payback dentro do range
      if (
        !out.payback_meses ||
        out.payback_meses < 1 ||
        out.payback_meses > 360
      ) {
        skips.push({
          versao_id: v.id,
          reason: `payback_out_of_range:${out.payback_meses}`,
        });
        continue;
      }

      const update: Record<string, number> = {};
      // FASE 2 — só sobrescrever NULL/0
      if (!v.payback_meses || Number(v.payback_meses) === 0) {
        update.payback_meses = out.payback_meses;
      }
      if (!v.tir || Number(v.tir) === 0) {
        update.tir = out.tir;
      }
      if (v.vpl === null || v.vpl === undefined) {
        update.vpl = out.vpl;
      }

      const fix: FixRecord = {
        versao_id: v.id,
        tenant_id: v.tenant_id,
        before: {
          payback: v.payback_meses,
          tir: v.tir,
          vpl: v.vpl,
        },
        after: {
          payback: out.payback_meses,
          tir: out.tir,
          vpl: out.vpl,
        },
        applied: false,
      };

      if (!dryRun && Object.keys(update).length > 0) {
        const { error: uErr } = await supa
          .from("proposta_versoes")
          .update(update)
          .eq("id", v.id);
        if (uErr) {
          skips.push({
            versao_id: v.id,
            reason: `update_error:${uErr.message}`,
          });
          continue;
        }
        fix.applied = true;

        // Log auditoria
        await supa.from("wave2_financial_fix_log").insert({
          tenant_id: v.tenant_id,
          versao_id: v.id,
          fix_type: "reprocess_missing_payback",
          before_value: v.payback_meses ?? 0,
          after_value: out.payback_meses,
          details: {
            source: "solarmarket",
            dryRun: false,
            motor: "calcFinancialSeries",
            updated_fields: Object.keys(update),
            tir_before: v.tir,
            tir_after: out.tir,
            vpl_before: v.vpl,
            vpl_after: out.vpl,
          },
        });
      }

      fixes.push(fix);
    }

    const summary = {
      ok: true,
      dryRun,
      limit,
      offset,
      candidates_in_chunk: targets.length,
      recalculated: fixes.length,
      applied: fixes.filter((f) => f.applied).length,
      skipped: skips.length,
      skips_by_reason: skips.reduce((acc, s) => {
        const k = s.reason.split(":")[0];
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      sample_fixes: fixes.slice(0, 5),
      sample_skips: skips.slice(0, 5),
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[reprocess-sm-financial-metrics] fatal", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
