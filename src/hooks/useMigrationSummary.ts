/**
 * useMigrationSummary — Resumo pré-migração calculado em memória a partir do staging.
 *
 * Lê totais de sm_clientes_raw / sm_projetos_raw / sm_propostas_raw e agrega:
 *  - distribuição por pipeline (Comercial padrão + funis auxiliares mapeados)
 *  - distribuição por consultor (regra: Vendedores → responsible.name → fallback)
 *  - distribuição por status canônico
 *
 * Não executa nenhum INSERT. Performance OK até ~5k projetos.
 *
 * RB-04 / RB-05.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 1000 * 60; // 1 min

export interface MigrationSummary {
  clientes_a_criar: number;
  projetos_a_criar: number;
  propostas_a_criar: number;
  distribuicaoPorPipeline: Array<[string, number]>;
  distribuicaoPorConsultor: Array<[string, number]>;
  distribuicaoPorStatus: Array<[string, number]>;
  funisSemMapeamento: string[];
}

const SM_STATUS_MAP: Record<string, string> = {
  draft: "rascunho",
  created: "rascunho",
  generated: "gerada",
  sent: "enviada",
  viewed: "enviada",
  accepted: "aceita",
  approved: "aceita",
  rejected: "recusada",
  expired: "expirada",
  cancelled: "cancelada",
  canceled: "cancelada",
};

function mapStatus(raw: string | null | undefined, accDate: string | null | undefined): string {
  if (accDate) return "aceita";
  const k = (raw ?? "").trim().toLowerCase();
  return SM_STATUS_MAP[k] ?? "rascunho";
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

async function fetchAllPaged<T>(
  build: () => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Loop até receber página parcial
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

type SmRawRow = { external_id?: string | number | null; payload: unknown };
type SmFunilRawRow = { payload: unknown };

export function useMigrationSummary(tenantId: string | null | undefined) {
  return useQuery<MigrationSummary>({
    queryKey: ["migration-summary", tenantId],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async () => {
      const tid = tenantId!;

      const [cliCount, projetosData, propostasData, projFunisData, consultorMap, funilMap, consultores] =
        await Promise.all([
          supabase
            .from("sm_clientes_raw")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tid),
          fetchAllPaged<SmRawRow>(() =>
            supabase
              .from("sm_projetos_raw")
              .select("external_id, payload")
              .eq("tenant_id", tid),
          ),
          fetchAllPaged<SmRawRow>(() =>
            supabase
              .from("sm_propostas_raw")
              .select("external_id, payload")
              .eq("tenant_id", tid),
          ),
          fetchAllPaged<SmFunilRawRow>(() =>
            supabase
              .from("sm_projeto_funis_raw")
              .select("payload")
              .eq("tenant_id", tid),
          ),
          supabase
            .from("sm_consultor_mapping")
            .select("sm_name, consultor_id, is_ex_funcionario")
            .eq("tenant_id", tid),
          supabase
            .from("sm_funil_pipeline_map")
            .select("sm_funil_name, pipeline_id, role")
            .eq("tenant_id", tid),
          supabase
            .from("consultores")
            .select("id, nome")
            .eq("tenant_id", tid)
            .eq("ativo", true),
        ]);

      if (cliCount.error) throw new Error(cliCount.error.message);
      if (projetos.error) throw new Error(projetos.error.message);
      if (propostas.error) throw new Error(propostas.error.message);
      if (projFunis.error) throw new Error(projFunis.error.message);
      if (consultorMap.error) throw new Error(consultorMap.error.message);
      if (funilMap.error) throw new Error(funilMap.error.message);
      if (consultores.error) throw new Error(consultores.error.message);

      // Lookups
      const consultoresById = new Map<string, string>();
      const consultoresByNome = new Map<string, string>();
      for (const c of consultores.data ?? []) {
        consultoresById.set(c.id as string, (c.nome as string) ?? "—");
        consultoresByNome.set(norm(c.nome as string), c.id as string);
      }
      const escritorioId =
        Array.from(consultoresByNome.entries()).find(([k]) => k.includes("escrit"))?.[1] ?? null;
      const fallbackNome = escritorioId ? consultoresById.get(escritorioId)! : "Escritório";

      const consultorMapByName = new Map<
        string,
        { consultor_id: string | null; is_ex: boolean }
      >();
      for (const m of consultorMap.data ?? []) {
        consultorMapByName.set(norm(m.sm_name as string), {
          consultor_id: (m.consultor_id as string) ?? null,
          is_ex: !!m.is_ex_funcionario,
        });
      }

      const funilMapByName = new Map<string, { pipeline_id: string | null; role: string | null }>();
      for (const m of funilMap.data ?? []) {
        funilMapByName.set(norm(m.sm_funil_name as string), {
          pipeline_id: (m.pipeline_id as string) ?? null,
          role: (m.role as string) ?? null,
        });
      }

      // Resolver nome dos pipelines (busca extra)
      const pipelineIds = Array.from(funilMapByName.values())
        .map((v) => v.pipeline_id)
        .filter((x): x is string => !!x);
      const pipelineNomeById = new Map<string, string>();
      if (pipelineIds.length > 0) {
        const { data: ps } = await supabase
          .from("projeto_funis")
          .select("id, nome")
          .in("id", pipelineIds);
        for (const p of ps ?? []) {
          pipelineNomeById.set(p.id as string, (p.nome as string) ?? "—");
        }
      }

      // Indexar funis SM por projeto
      type SmFunil = { name: string; stageName: string | null; status: string | null };
      const funisPorProjeto = new Map<string, SmFunil[]>();
      for (const r of projFunis.data ?? []) {
        const p = (r.payload as Record<string, unknown>) ?? {};
        const projId = String(((p.project as Record<string, unknown>)?.id as string | number) ?? "");
        if (!projId) continue;
        const list = funisPorProjeto.get(projId) ?? [];
        list.push({
          name: String(((p.name as string) ?? "")).trim(),
          stageName:
            ((p.stage as Record<string, unknown>)?.name as string | undefined)?.trim() ?? null,
          status: (p.status as string | undefined) ?? null,
        });
        funisPorProjeto.set(projId, list);
      }

      // Indexar propostas por projeto
      const propsPorProjeto = new Map<string, Array<{ status: string | null; acc: string | null }>>();
      for (const r of propostas.data ?? []) {
        const p = (r.payload as Record<string, unknown>) ?? {};
        const projId = String(((p.project as Record<string, unknown>)?.id as string | number) ?? "");
        if (!projId) continue;
        const list = propsPorProjeto.get(projId) ?? [];
        list.push({
          status: (p.status as string | undefined) ?? null,
          acc: (p.acceptanceDate as string | undefined) ?? null,
        });
        propsPorProjeto.set(projId, list);
      }

      const distPipeline = new Map<string, number>();
      const distConsultor = new Map<string, number>();
      const distStatus = new Map<string, number>();
      const funisSemMapeamento = new Set<string>();

      const incr = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

      for (const proj of projetos.data ?? []) {
        const projId = String(proj.external_id ?? "");
        const payload = (proj.payload as Record<string, unknown>) ?? {};
        const responsible = (payload.responsible as Record<string, unknown>) ?? {};
        const respName = norm(responsible.name as string);

        // ── Pipeline (Comercial sempre + auxiliares mapeados) ──
        incr(distPipeline, "Comercial");
        const funis = funisPorProjeto.get(projId) ?? [];
        for (const f of funis) {
          const fname = norm(f.name);
          if (!fname || fname === "vendedores" || fname === "comercial") continue;
          const aux = funilMapByName.get(fname);
          if (aux?.pipeline_id) {
            incr(distPipeline, pipelineNomeById.get(aux.pipeline_id) ?? f.name);
          } else {
            funisSemMapeamento.add(f.name);
          }
        }

        // ── Consultor (Prio 1: Vendedores → stage → mapping) ──
        let consultorLabel: string | null = null;
        const vendedoresFunil = funis.find((f) => norm(f.name) === "vendedores");
        if (vendedoresFunil?.stageName) {
          const m = consultorMapByName.get(norm(vendedoresFunil.stageName));
          if (m?.consultor_id) {
            consultorLabel = `${consultoresById.get(m.consultor_id) ?? vendedoresFunil.stageName} (Vendedores)`;
          } else if (m?.is_ex) {
            consultorLabel = `${fallbackNome} (fallback)`;
          }
        }
        // Prio 2: responsible.name match
        if (!consultorLabel && respName) {
          const cid = consultoresByNome.get(respName);
          if (cid) {
            consultorLabel = `${consultoresById.get(cid)} (responsible)`;
          }
        }
        // Fallback
        if (!consultorLabel) consultorLabel = `${fallbackNome} (fallback)`;
        incr(distConsultor, consultorLabel);

        // ── Status (toma proposta mais "avançada" se houver) ──
        const props = propsPorProjeto.get(projId) ?? [];
        if (props.length === 0) {
          incr(distStatus, "rascunho");
        } else {
          // Conta o status de cada proposta (1 deal por proposta no canônico)
          for (const p of props) incr(distStatus, mapStatus(p.status, p.acc));
        }
      }

      const sortDesc = (m: Map<string, number>) =>
        Array.from(m.entries()).sort((a, b) => b[1] - a[1]);

      return {
        clientes_a_criar: cliCount.count ?? 0,
        projetos_a_criar: (projetos.data ?? []).length,
        propostas_a_criar: (propostas.data ?? []).length,
        distribuicaoPorPipeline: sortDesc(distPipeline),
        distribuicaoPorConsultor: sortDesc(distConsultor),
        distribuicaoPorStatus: sortDesc(distStatus),
        funisSemMapeamento: Array.from(funisSemMapeamento).sort(),
      };
    },
  });
}
