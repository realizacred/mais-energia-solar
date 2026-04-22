/**
 * useSolarmarketDiagnostic — diagnóstico de mapeamento entre funis/etapas
 * do SolarMarket (staging) e os pipelines/stages nativos do tenant.
 *
 * Governança:
 *   - RB-04: queries em hook dedicado
 *   - RB-05: staleTime obrigatório
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 2;

export interface SmFunilInfo {
  nome: string;
  etapas: string[];
  totalPropostas: number;
}

export interface NativePipeline {
  id: string;
  name: string;
  is_active: boolean;
  is_default: boolean;
  stages: NativeStage[];
}

export interface NativeStage {
  id: string;
  name: string;
  position: number;
  pipeline_id: string;
}

export interface PipelineMatch {
  smFunil: string;
  nativePipeline: NativePipeline | null;
  matched: boolean;
  totalPropostas: number;
}

export interface StageMatch {
  smFunil: string;
  smEtapa: string;
  nativeStage: NativeStage | null;
  matched: boolean;
}

export interface DiagnosticData {
  smFunis: SmFunilInfo[];
  pipelines: NativePipeline[];
  comercialPipeline: NativePipeline | null;
  pipelineMatches: PipelineMatch[];
  stageMatches: StageMatch[];
}

const DEFAULT_STAGE_NAMES = ["Prospecção", "Análise", "Proposta", "Aprovada", "Perdida"];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchDiagnostic(): Promise<DiagnosticData> {
  // 1) Funis e etapas únicos vindos das propostas em staging
  const { data: propRaw, error: propErr } = await supabase
    .from("sm_propostas_raw")
    .select("payload")
    .limit(5000);
  if (propErr) throw new Error(propErr.message);

  const funilMap = new Map<string, { etapas: Map<string, number>; total: number }>();
  for (const row of propRaw ?? []) {
    const p = (row as { payload: Record<string, unknown> }).payload ?? {};
    const funil = (p.funil as string) || (p.funnel as string) || "Comercial";
    const etapa = (p.etapa as string) || (p.stage as string) || "—";
    if (!funilMap.has(funil)) funilMap.set(funil, { etapas: new Map(), total: 0 });
    const entry = funilMap.get(funil)!;
    entry.total += 1;
    entry.etapas.set(etapa, (entry.etapas.get(etapa) ?? 0) + 1);
  }

  const smFunis: SmFunilInfo[] = Array.from(funilMap.entries())
    .map(([nome, v]) => ({ nome, totalPropostas: v.total, etapas: Array.from(v.etapas.keys()) }))
    .sort((a, b) => b.totalPropostas - a.totalPropostas);

  // 2) Pipelines nativos + stages
  const { data: pipes, error: pipeErr } = await supabase
    .from("pipelines")
    .select("id, name, is_active, is_default")
    .eq("is_active", true)
    .order("name");
  if (pipeErr) throw new Error(pipeErr.message);

  const pipeIds = (pipes ?? []).map((p) => p.id);
  let stagesByPipe: Record<string, NativeStage[]> = {};
  if (pipeIds.length) {
    const { data: stages, error: stErr } = await supabase
      .from("pipeline_stages")
      .select("id, name, position, pipeline_id")
      .in("pipeline_id", pipeIds)
      .order("position");
    if (stErr) throw new Error(stErr.message);
    stagesByPipe = (stages ?? []).reduce<Record<string, NativeStage[]>>((acc, s) => {
      (acc[s.pipeline_id] ||= []).push(s as NativeStage);
      return acc;
    }, {});
  }

  const pipelines: NativePipeline[] = (pipes ?? []).map((p) => ({
    ...(p as Omit<NativePipeline, "stages">),
    stages: stagesByPipe[p.id] ?? [],
  }));

  const comercialPipeline =
    pipelines.find((p) => normalize(p.name) === "comercial") ?? null;

  // 3) Match funil → pipeline
  const pipelineMatches: PipelineMatch[] = smFunis.map((f) => {
    const np = pipelines.find((p) => normalize(p.name) === normalize(f.nome)) ?? null;
    return { smFunil: f.nome, nativePipeline: np, matched: !!np, totalPropostas: f.totalPropostas };
  });

  // 4) Match etapas
  const stageMatches: StageMatch[] = [];
  for (const f of smFunis) {
    const np =
      pipelines.find((p) => normalize(p.name) === normalize(f.nome)) ?? comercialPipeline;
    for (const etapa of f.etapas) {
      const ns = np?.stages.find((s) => normalize(s.name) === normalize(etapa)) ?? null;
      stageMatches.push({ smFunil: f.nome, smEtapa: etapa, nativeStage: ns, matched: !!ns });
    }
  }

  return { smFunis, pipelines, comercialPipeline, pipelineMatches, stageMatches };
}

export function useSolarmarketDiagnostic() {
  return useQuery<DiagnosticData>({
    queryKey: ["solarmarket-diagnostic"],
    queryFn: fetchDiagnostic,
    staleTime: STALE_TIME,
  });
}

/**
 * Mutation: cria pipelines faltantes (mesmo nome do funil SM) com stages padrão.
 */
export function useCreateMissingPipelines() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (missingNames: string[]) => {
      const created: { name: string; id: string }[] = [];
      for (const name of missingNames) {
        const { data: pipe, error: pErr } = await supabase
          .from("pipelines")
          .insert({ name, is_active: true } as never)
          .select("id, name")
          .single();
        if (pErr) throw new Error(`Pipeline "${name}": ${pErr.message}`);

        const stagesPayload = DEFAULT_STAGE_NAMES.map((sn, idx) => ({
          pipeline_id: pipe.id,
          name: sn,
          position: idx,
          is_closed: sn === "Aprovada" || sn === "Perdida",
          is_won: sn === "Aprovada",
        }));
        const { error: sErr } = await supabase
          .from("pipeline_stages")
          .insert(stagesPayload as never);
        if (sErr) throw new Error(`Stages de "${name}": ${sErr.message}`);

        created.push({ name: pipe.name, id: pipe.id });
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solarmarket-diagnostic"] });
    },
  });
}
