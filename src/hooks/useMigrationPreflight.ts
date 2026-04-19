/**
 * useMigrationPreflight — Pré-validação e estimativa de impacto antes de
 * criar um job de migração SolarMarket.
 *
 * Calcula sem mutar nada:
 *   - Lead a ser ignorado
 *   - Vendedor → Comercial a ser convertido
 *   - Etapas que podem precisar ser criadas (estimativa por nome distinto)
 *   - Se a classificação já foi rodada (sm_project_classification existe)
 *   - Bloqueios (sem tenant, sem staging)
 *
 * Heurística de leitura: usa o nome do funil em solar_market_projects
 * (campo `funnel_name` quando existir; senão tenta `funnel`).
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
  leadIgnored: number;
  comercialConverted: number;
  otherProjects: number;
  distinctSourceStages: number;
  missingStagesEstimate: number;
  classificationDone: boolean;
  blocked: boolean;
  blockReason: string | null;
}

const LEAD_RE = /^lead(s)?$/i;
const COMERCIAL_RE = /comercial|venda|vendedor|consultor/i;

export function useMigrationPreflight(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["migration-preflight", tenantId],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async (): Promise<PreflightResult> => {
      if (!tenantId) {
        return emptyResult({ blocked: true, blockReason: "Selecione um tenant" });
      }

      // 1) Contagens base
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
        };
      }

      // 2) Classificação por funil — leitura tolerante a colunas opcionais
      let leadIgnored = 0;
      let comercialConverted = 0;
      let otherProjects = 0;
      const sourceStages = new Set<string>();

      try {
        const { data: projRows } = await (supabase as any)
          .from("solar_market_projects")
          .select("funnel_name, stage_name")
          .eq("tenant_id", tenantId)
          .limit(10000);

        for (const r of projRows ?? []) {
          const funil = String(r?.funnel_name ?? "").trim();
          const etapa = String(r?.stage_name ?? "").trim();
          if (etapa) sourceStages.add(etapa.toLowerCase());

          if (!funil) {
            otherProjects++;
            continue;
          }
          if (LEAD_RE.test(funil)) leadIgnored++;
          else if (COMERCIAL_RE.test(funil)) comercialConverted++;
          else otherProjects++;
        }
      } catch {
        // Se as colunas não existirem nesse schema, deixa zerado e segue.
      }

      // 3) Etapas faltando — comparamos os nomes distintos da origem
      //    com os nomes presentes em pipeline_stages do tenant.
      let missingStagesEstimate = 0;
      try {
        const { data: nativeStages } = await supabase
          .from("pipeline_stages" as any)
          .select("nome")
          .eq("tenant_id", tenantId);
        const nativeSet = new Set(
          (nativeStages ?? []).map((s: any) => String(s.nome ?? "").trim().toLowerCase()),
        );
        for (const s of sourceStages) {
          if (!nativeSet.has(s)) missingStagesEstimate++;
        }
      } catch {
        missingStagesEstimate = 0;
      }

      // 4) Classificação já rodou? (existe ao menos 1 linha)
      let classificationDone = false;
      try {
        const { count } = await (supabase as any)
          .from("sm_project_classification")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);
        classificationDone = (count ?? 0) > 0;
      } catch {
        classificationDone = false;
      }

      return {
        tenantOk: true,
        stagingOk: true,
        totalClients,
        totalProjects,
        totalProposals,
        leadIgnored,
        comercialConverted,
        otherProjects,
        distinctSourceStages: sourceStages.size,
        missingStagesEstimate,
        classificationDone,
        blocked: false,
        blockReason: null,
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
    leadIgnored: 0,
    comercialConverted: 0,
    otherProjects: 0,
    distinctSourceStages: 0,
    missingStagesEstimate: 0,
    classificationDone: false,
    blocked: false,
    blockReason: null,
    ...over,
  };
}
