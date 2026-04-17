/**
 * useSmMigrationV3 — Single source of truth for the SolarMarket migration v3 panel.
 *
 * §16 Queries em hooks. §23 staleTime obrigatório.
 * RB-57: estado por hook, sem singletons mutáveis.
 *
 * Backend integrado:
 *   - classify-sm-projects        → calcula sm_project_classification
 *   - create-projetos-from-sm     → cria clientes/projetos nativos
 *   - migrate-sm-proposals-v3     → aplica funil/etapa por registro
 *
 * Toda a UI (KPIs, distribuição, terminal, contagem de erros) deve derivar
 * EXCLUSIVAMENTE do RunResult retornado por estas mutations + dos counters
 * desta query — nunca de fontes paralelas.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

const STALE = 1000 * 30;

// ─── Tipos públicos ────────────────────────────────────────────────────

export type RunKind = "classify" | "create" | "apply";

export interface RunResult {
  kind: RunKind;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  raw: any;
  /** Itens processados com sucesso pelo step. */
  successCount: number;
  /** Falhas reais reportadas pelo backend. ÚNICA fonte para "Erros última rodada". */
  failedCount: number;
  /** Amostra de falhas (até 20) já formatada para o terminal. */
  failedSample: Array<{ ref: string | number; reason: string }>;
  /** Linhas formatadas para o terminal/log. */
  logLines: string[];
}

export interface MigrationCounters {
  /** Projetos SM com proposta (única regra canônica de elegibilidade). */
  eligible: number;
  /** Projetos SM já classificados em sm_project_classification. */
  classified: number;
  /** Projetos nativos já criados a partir de SM (projetos.sm_project_id NOT NULL). */
  projectsCreated: number;
  /** Clientes nativos já criados a partir de SM. */
  clientsCreated: number;
  /** Projetos com funil/etapa aplicada (funil_id + etapa_id NOT NULL). */
  funnelsApplied: number;
}

export interface DistributionRow {
  funilNome: string;
  etapaNome: string;
  total: number;
}

// ─── Query: counters globais (SSOT para o Bloco A — "Resumo") ───────────

export function useSmMigrationCounters() {
  return useQuery<MigrationCounters>({
    queryKey: ["sm-migration-v3", "counters"],
    queryFn: async () => {
      const { tenantId } = await getCurrentTenantId();

      const [eligibleRes, classifiedRes, projsRes, clientsRes, appliedRes] = await Promise.all([
        // Elegíveis = projetos SM distintos com proposta. Aproximação leve via count
        // dos projetos SM marcados como migráveis. Mantemos o COUNT de
        // sm_project_classification como teto de elegíveis ao lado.
        (supabase as any)
          .from("solar_market_projects")
          .select("sm_project_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("sm_project_classification")
          .select("sm_project_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("sm_project_id", "is", null),
        (supabase as any)
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("sm_client_id", "is", null),
        (supabase as any)
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("sm_project_id", "is", null)
          .not("funil_id", "is", null)
          .not("etapa_id", "is", null),
      ]);

      return {
        eligible: eligibleRes.count ?? 0,
        classified: classifiedRes.count ?? 0,
        projectsCreated: projsRes.count ?? 0,
        clientsCreated: clientsRes.count ?? 0,
        funnelsApplied: appliedRes.count ?? 0,
      };
    },
    staleTime: STALE,
  });
}

// ─── Query: distribuição automática (Bloco B) ───────────────────────────

export function useSmClassificationDistribution() {
  return useQuery<DistributionRow[]>({
    queryKey: ["sm-migration-v3", "distribution"],
    queryFn: async () => {
      const { tenantId } = await getCurrentTenantId();

      // 1) classificações com IDs de funil/etapa
      const { data: rows, error } = await (supabase as any)
        .from("sm_project_classification")
        .select("funil_destino_id, etapa_destino_id")
        .eq("tenant_id", tenantId)
        .not("funil_destino_id", "is", null)
        .not("etapa_destino_id", "is", null);
      if (error) throw error;

      const buckets = new Map<string, number>();
      for (const r of rows ?? []) {
        const key = `${r.funil_destino_id}::${r.etapa_destino_id}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      if (buckets.size === 0) return [];

      const funilIds = new Set<string>();
      const etapaIds = new Set<string>();
      for (const k of buckets.keys()) {
        const [f, e] = k.split("::");
        funilIds.add(f);
        etapaIds.add(e);
      }

      const [{ data: funis }, { data: etapas }] = await Promise.all([
        (supabase as any)
          .from("projeto_funis")
          .select("id, nome")
          .in("id", Array.from(funilIds)),
        (supabase as any)
          .from("projeto_etapas")
          .select("id, nome")
          .in("id", Array.from(etapaIds)),
      ]);

      const funilMap = new Map<string, string>((funis ?? []).map((f: any) => [f.id, f.nome]));
      const etapaMap = new Map<string, string>((etapas ?? []).map((e: any) => [e.id, e.nome]));

      const out: DistributionRow[] = [];
      for (const [key, total] of buckets.entries()) {
        const [f, e] = key.split("::");
        out.push({
          funilNome: funilMap.get(f) ?? "Funil ?",
          etapaNome: etapaMap.get(e) ?? "Etapa ?",
          total,
        });
      }
      out.sort((a, b) => b.total - a.total);
      return out;
    },
    staleTime: STALE,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour12: false });
}

// ─── Mutations: classify / create / apply ───────────────────────────────

/**
 * Roda classify-sm-projects.
 * Saída esperada: { total_eligible, classified, skipped, overridden_preserved, ... }
 */
export function useClassifyMutation() {
  const qc = useQueryClient();
  return useMutation<RunResult, Error, { reclassifyAll?: boolean }>({
    mutationFn: async ({ reclassifyAll = false }) => {
      const startedAt = nowIso();
      const { tenantId } = await getCurrentTenantId();

      const { data, error } = await supabase.functions.invoke("classify-sm-projects", {
        body: { tenant_id: tenantId, reclassify_all: reclassifyAll },
      });

      const finishedAt = nowIso();
      if (error) {
        return {
          kind: "classify",
          ok: false,
          startedAt,
          finishedAt,
          raw: { error: error.message },
          successCount: 0,
          failedCount: 1,
          failedSample: [{ ref: "classify", reason: error.message }],
          logLines: [
            `[${fmtTime(startedAt)}] Iniciando classificação...`,
            `[${fmtTime(finishedAt)}] ERRO: ${error.message}`,
          ],
        };
      }

      const classified = Number(data?.classified ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const totalEligible = Number(data?.total_eligible ?? 0);

      return {
        kind: "classify",
        ok: true,
        startedAt,
        finishedAt,
        raw: data,
        successCount: classified,
        failedCount: 0,
        failedSample: [],
        logLines: [
          `[${fmtTime(startedAt)}] Classificação iniciada`,
          `[${fmtTime(finishedAt)}] Elegíveis: ${totalEligible} · Classificados: ${classified} · Ignorados: ${skipped}`,
        ],
      };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
    },
  });
}

/**
 * Roda create-projetos-from-sm.
 * Saída esperada: { mode, eligible, inserted_projects, inserted_clients, failed_count, failed_sample[] }
 */
export function useCreateProjetosMutation() {
  const qc = useQueryClient();
  return useMutation<RunResult, Error, { confirmApply: boolean; limit?: number }>({
    mutationFn: async ({ confirmApply, limit }) => {
      const startedAt = nowIso();
      const { tenantId } = await getCurrentTenantId();

      const { data, error } = await supabase.functions.invoke("create-projetos-from-sm", {
        body: {
          tenant_id: tenantId,
          confirm_apply: confirmApply,
          ...(limit ? { limit } : {}),
        },
      });
      const finishedAt = nowIso();

      if (error) {
        return {
          kind: "create",
          ok: false,
          startedAt,
          finishedAt,
          raw: { error: error.message },
          successCount: 0,
          failedCount: 1,
          failedSample: [{ ref: "create", reason: error.message }],
          logLines: [
            `[${fmtTime(startedAt)}] Criação de projetos iniciada (${confirmApply ? "APPLY" : "dry-run"})`,
            `[${fmtTime(finishedAt)}] ERRO: ${error.message}`,
          ],
        };
      }

      const inserted = Number(data?.inserted_projects ?? data?.would_insert_projects ?? 0);
      const insertedClients = Number(data?.inserted_clients ?? data?.would_insert_clients ?? 0);
      const failedCount = Number(data?.failed_count ?? 0);
      const sample = Array.isArray(data?.failed_sample) ? data.failed_sample : [];

      return {
        kind: "create",
        ok: failedCount === 0,
        startedAt,
        finishedAt,
        raw: data,
        successCount: inserted,
        failedCount,
        failedSample: sample.map((s: any) => ({
          ref: s.sm_project_id ?? "?",
          reason: s.reason ?? "sem motivo",
        })),
        logLines: [
          `[${fmtTime(startedAt)}] Criação de projetos (${confirmApply ? "APPLY" : "dry-run"})`,
          `[${fmtTime(finishedAt)}] Projetos: ${inserted} · Clientes: ${insertedClients} · Falhas: ${failedCount}`,
          ...sample.slice(0, 5).map((s: any) => `  ↳ ${s.sm_project_id ?? "?"}: ${s.reason ?? ""}`),
        ],
      };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
    },
  });
}

/**
 * Roda migrate-sm-proposals-v3 (aplica funil/etapa por classificação).
 * Saída esperada: { dry_run, counters: { updated, would_update, failed, errors[] } }
 */
export function useApplyFunilMutation() {
  const qc = useQueryClient();
  return useMutation<RunResult, Error, { confirmApply: boolean; limit?: number }>({
    mutationFn: async ({ confirmApply, limit }) => {
      const startedAt = nowIso();
      const { tenantId } = await getCurrentTenantId();

      const { data, error } = await supabase.functions.invoke("migrate-sm-proposals-v3", {
        body: {
          tenant_id: tenantId,
          confirm_apply: confirmApply,
          ...(limit ? { limit } : {}),
        },
      });
      const finishedAt = nowIso();

      if (error) {
        return {
          kind: "apply",
          ok: false,
          startedAt,
          finishedAt,
          raw: { error: error.message },
          successCount: 0,
          failedCount: 1,
          failedSample: [{ ref: "apply", reason: error.message }],
          logLines: [
            `[${fmtTime(startedAt)}] Aplicação de funil/etapa iniciada (${confirmApply ? "APPLY" : "dry-run"})`,
            `[${fmtTime(finishedAt)}] ERRO: ${error.message}`,
          ],
        };
      }

      const c = data?.counters ?? {};
      const updated = Number(c.updated ?? c.would_update ?? 0);
      const failedCount = Number(c.failed ?? (Array.isArray(c.errors) ? c.errors.length : 0));
      const errors = Array.isArray(c.errors) ? c.errors : [];

      return {
        kind: "apply",
        ok: failedCount === 0,
        startedAt,
        finishedAt,
        raw: data,
        successCount: updated,
        failedCount,
        failedSample: errors.slice(0, 20).map((e: any) => ({
          ref: e.sm_project_id ?? "?",
          reason: e.error ?? "erro",
        })),
        logLines: [
          `[${fmtTime(startedAt)}] Aplicação de funil/etapa (${confirmApply ? "APPLY" : "dry-run"})`,
          `[${fmtTime(finishedAt)}] Atualizados: ${updated} · Elegíveis: ${c.eligible ?? "?"} · Classificados: ${c.classified ?? "?"} · Falhas: ${failedCount}`,
          ...errors.slice(0, 5).map((e: any) => `  ↳ ${e.sm_project_id ?? "?"}: ${e.error ?? ""}`),
        ],
      };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
    },
  });
}
