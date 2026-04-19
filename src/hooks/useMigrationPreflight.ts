/**
 * useMigrationPreflight — Pré-validação e estimativa de impacto antes de
 * criar um job de migração SolarMarket.
 *
 * Calcula sem mutar nada:
 *   - Projetos com funil "Vendedores" → consultor responsável (não vira funil)
 *   - Projetos com sm_funnel_name NULL → tratados como pipeline Comercial
 *   - Etapas que podem precisar ser criadas (estimativa por nome distinto)
 *   - Bloqueios (sem tenant, sem staging)
 *
 * IMPORTANTE: as colunas reais no staging são `sm_funnel_name` e
 * `sm_stage_name` (com prefixo). NUNCA usar `funnel_name`/`stage_name`.
 *
 * A dependência de `sm_project_classification` foi removida — essa tabela
 * não existe mais no schema. A classificação é feita on-the-fly pela
 * edge function `migration-execute-job`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 1000 * 30; // 30s — pré-vôo precisa estar fresco

export interface PreflightResult {
  tenantOk: boolean;
  stagingOk: boolean;
  totalProjects: number;
  totalClients: number;
  totalProposals: number;
  /** Projetos cujo "funil" no SM é o nome de um vendedor (vira consultor) */
  vendedorAsConsultor: number;
  /** Projetos com sm_funnel_name NULL/vazio → fallback Comercial */
  defaultedToComercial: number;
  /** Demais projetos com funil nominal preservado */
  otherProjects: number;
  distinctSourceStages: number;
  missingStagesEstimate: number;
  blocked: boolean;
  blockReason: string | null;
  /** Diagnóstico não-fatal (colunas faltando, falhas parciais) */
  diagnostics: string[];
}

const VENDEDOR_FUNNEL_RE = /vendedor(es)?/i;

/** Normaliza nome de etapa: trim, lowercase, remove acentos e colapsa espaços. */
function normalizeStageName(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function useMigrationPreflight(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["migration-preflight", tenantId],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async (): Promise<PreflightResult> => {
      if (!tenantId) {
        return emptyResult({ blocked: true, blockReason: "Selecione um tenant" });
      }

      const diagnostics: string[] = [];

      // 1) Contagens base — falha aqui é bloqueante
      const [clientsRes, projectsRes, proposalsRes] = await Promise.all([
        (supabase as any)
          .from("solar_market_clients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("solar_market_projects")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
      ]);

      if (clientsRes.error) diagnostics.push(`clients: ${clientsRes.error.message}`);
      if (projectsRes.error) diagnostics.push(`projects: ${projectsRes.error.message}`);
      if (proposalsRes.error) diagnostics.push(`proposals: ${proposalsRes.error.message}`);

      const totalClients = clientsRes.count ?? 0;
      const totalProjects = projectsRes.count ?? 0;
      const totalProposals = proposalsRes.count ?? 0;
      const stagingOk = totalClients + totalProjects + totalProposals > 0;

      if (!stagingOk) {
        return {
          ...emptyResult({
            blocked: true,
            blockReason: "Tenant sem dados de staging",
          }),
          tenantOk: true,
          totalClients,
          totalProjects,
          totalProposals,
          diagnostics,
        };
      }

      // 2) Classificação por funil — colunas reais do staging
      // Paginação para evitar teto silencioso (sem limit arbitrário).
      let vendedorAsConsultor = 0;
      let defaultedToComercial = 0;
      let otherProjects = 0;
      const sourceStages = new Set<string>();

      const PAGE = 1000;
      const HARD_CAP = 100_000; // 50x o volume real conhecido — apenas guarda
      let from = 0;
      let pagedErr: any = null;
      while (from < HARD_CAP) {
        const { data: page, error: pErr } = await (supabase as any)
          .from("solar_market_projects")
          .select("sm_funnel_name, sm_stage_name")
          .eq("tenant_id", tenantId)
          .range(from, from + PAGE - 1);
        if (pErr) { pagedErr = pErr; break; }
        const rows = page ?? [];
        for (const r of rows) {
          const funil = String(r?.sm_funnel_name ?? "").trim();
          const etapa = String(r?.sm_stage_name ?? "").trim();
          if (!funil) { defaultedToComercial++; continue; }
          if (VENDEDOR_FUNNEL_RE.test(funil)) { vendedorAsConsultor++; continue; }
          otherProjects++;
          if (etapa) sourceStages.add(normalizeStageName(etapa));
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (pagedErr) {
        diagnostics.push(`projects.sm_funnel_name: ${pagedErr.message}`);
      } else if (from >= HARD_CAP) {
        diagnostics.push(`HARD_CAP de ${HARD_CAP} atingido — possível subcontagem`);
      }

      // 3) Etapas faltando — pipeline_stages.name (não "nome") é o real.
      let missingStagesEstimate = 0;
      const { data: nativeStages, error: stagesErr } = await (supabase as any)
        .from("pipeline_stages")
        .select("name")
        .eq("tenant_id", tenantId);

      if (stagesErr) {
        diagnostics.push(`pipeline_stages: ${stagesErr.message}`);
      } else {
        const nativeSet = new Set(
          (nativeStages ?? []).map((s: any) => normalizeStageName(s.name)),
        );
        for (const s of sourceStages) {
          if (!nativeSet.has(s)) missingStagesEstimate++;
        }
      }

      return {
        tenantOk: true,
        stagingOk: true,
        totalClients,
        totalProjects,
        totalProposals,
        vendedorAsConsultor,
        defaultedToComercial,
        otherProjects,
        distinctSourceStages: sourceStages.size,
        missingStagesEstimate,
        blocked: false,
        blockReason: null,
        diagnostics,
      };
    },
  });
}

function emptyResult(over: Partial<PreflightResult>): PreflightResult {
  return {
    tenantOk: false,
    stagingOk: false,
    totalProjects: 0,
    totalClients: 0,
    totalProposals: 0,
    vendedorAsConsultor: 0,
    defaultedToComercial: 0,
    otherProjects: 0,
    distinctSourceStages: 0,
    missingStagesEstimate: 0,
    blocked: false,
    blockReason: null,
    diagnostics: [],
    ...over,
  };
}
