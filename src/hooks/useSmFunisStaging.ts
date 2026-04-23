/**
 * useSmFunisStaging — lê os funis do staging do SolarMarket (sm_funis_raw)
 * para a tela de mapeamento (Step 2). Inclui contagem de etapas e de
 * vínculos projeto→funil.
 *
 * Governança:
 *  - RB-04: query em hook dedicado
 *  - RB-05: staleTime obrigatório
 *  - RB-58: mutation crítica usa .select() para confirmar gravação
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export type FunilPapel = "pipeline" | "vendedor_source" | "tag" | "ignore";

export interface SmFunilStagingRow {
  /** id externo do funil no SolarMarket (string para evitar perda de precisão) */
  smFunilId: string;
  nome: string;
  qtdEtapas: number;
  qtdProjetosVinculados: number;
  /** papel atualmente salvo (vem de sm_funil_pipeline_map) */
  papel: FunilPapel | null;
  /** pipeline mapeado (apenas quando papel='pipeline') */
  pipelineId: string | null;
}

interface RawFunilPayload {
  id?: number | string;
  name?: string;
  stages?: unknown[];
}

interface RawFunilRow {
  external_id: string;
  payload: RawFunilPayload | null;
}

interface MapRow {
  sm_funil_name: string;
  pipeline_id: string | null;
  role: FunilPapel;
}

interface ProjetoFunilRow {
  payload: { funnel?: { id?: number | string } } | null;
}

export function useSmFunisStaging(tenantId: string | undefined) {
  return useQuery<SmFunilStagingRow[]>({
    queryKey: ["sm-funis-staging", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const [funisRes, mapRes, projFunisRes] = await Promise.all([
        supabase
          .from("sm_funis_raw")
          .select("external_id, payload")
          .eq("tenant_id", tenantId),
        supabase
          .from("sm_funil_pipeline_map")
          .select("sm_funil_name, pipeline_id, role")
          .eq("tenant_id", tenantId),
        supabase
          .from("sm_projeto_funis_raw")
          .select("payload")
          .eq("tenant_id", tenantId),
      ]);

      if (funisRes.error) throw new Error(funisRes.error.message);
      if (mapRes.error) throw new Error(mapRes.error.message);
      if (projFunisRes.error) throw new Error(projFunisRes.error.message);

      const funis = (funisRes.data ?? []) as RawFunilRow[];
      const mapas = (mapRes.data ?? []) as MapRow[];
      const projFunis = (projFunisRes.data ?? []) as ProjetoFunilRow[];

      // Contagem de projetos por funil (id externo do funil).
      const countByFunilId = new Map<string, number>();
      for (const row of projFunis) {
        const fid = row?.payload?.funnel?.id;
        if (fid === undefined || fid === null) continue;
        const key = String(fid);
        countByFunilId.set(key, (countByFunilId.get(key) ?? 0) + 1);
      }

      const mapaByName = new Map<string, MapRow>();
      for (const m of mapas) mapaByName.set(m.sm_funil_name, m);

      return funis
        .map<SmFunilStagingRow>((f) => {
          const nome = String(f.payload?.name ?? "").trim() || "(sem nome)";
          const stages = Array.isArray(f.payload?.stages) ? f.payload!.stages! : [];
          const m = mapaByName.get(nome) ?? null;
          return {
            smFunilId: f.external_id,
            nome,
            qtdEtapas: stages.length,
            qtdProjetosVinculados: countByFunilId.get(f.external_id) ?? 0,
            papel: m?.role ?? null,
            pipelineId: m?.pipeline_id ?? null,
          };
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

interface SaveFunilPapelInput {
  tenantId: string;
  smFunilName: string;
  papel: FunilPapel;
  /** obrigatório quando papel='pipeline'; ignorado nos demais casos */
  pipelineId?: string | null;
}

export function useSaveFunilPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveFunilPapelInput) => {
      const { tenantId, smFunilName, papel, pipelineId } = input;
      if (papel === "pipeline" && !pipelineId) {
        throw new Error(
          'É necessário escolher um pipeline antes de salvar o papel "pipeline".'
        );
      }
      const row = {
        tenant_id: tenantId,
        sm_funil_name: smFunilName,
        role: papel,
        pipeline_id: papel === "pipeline" ? pipelineId ?? null : null,
      };

      // RB-58: confirmar gravação com .select()
      const { data, error } = await supabase
        .from("sm_funil_pipeline_map")
        .upsert(row, { onConflict: "tenant_id,sm_funil_name" })
        .select("id");

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Falha ao salvar o papel do funil (0 linhas afetadas).");
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sm-funis-staging", vars.tenantId] });
      qc.invalidateQueries({ queryKey: ["sm-funil-map"] });
    },
  });
}
