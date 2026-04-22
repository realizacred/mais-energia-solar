/**
 * useDefaultPipeline — Verifica se o tenant atual possui pipeline padrão definido.
 *
 * Usado pela tela de Promoção SolarMarket para bloquear ações quando o tenant
 * não tem nenhum pipeline marcado como `is_default = true`.
 *
 * Governança:
 *   - RB-04/RB-05: query em hook dedicado com staleTime
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DefaultPipelineInfo {
  id: string;
  name: string;
  stagesCount: number;
}

const DEFAULT_PROJECT_STAGES = [
  { nome: "Novo Lead", cor: "#3B82F6", ordem: 0, categoria: "aberto" as const },
  { nome: "Proposta Criada", cor: "#F59E0B", ordem: 1, categoria: "aberto" as const },
  { nome: "Proposta Enviada", cor: "#8B5CF6", ordem: 2, categoria: "aberto" as const },
  { nome: "Fechado", cor: "#10B981", ordem: 3, categoria: "ganho" as const },
  { nome: "Perdido", cor: "#EF4444", ordem: 4, categoria: "perdido" as const },
];

async function fetchDefaultProjectPipeline(): Promise<DefaultPipelineInfo | null> {
  const { data: comercial, error: comercialError } = await supabase
    .from("projeto_funis")
    .select("id, nome")
    .eq("ativo", true)
    .ilike("nome", "comercial")
    .limit(1)
    .maybeSingle();

  if (comercialError) throw new Error(comercialError.message);

  const pipeline = comercial ?? await (async () => {
    const { data: first, error: firstError } = await supabase
      .from("projeto_funis")
      .select("id, nome")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstError) throw new Error(firstError.message);
    return first;
  })();

  if (!pipeline) return null;

  const { count, error: stageError } = await supabase
    .from("projeto_etapas")
    .select("id", { count: "exact", head: true })
    .eq("funil_id", pipeline.id);

  if (stageError) throw new Error(stageError.message);

  return { id: pipeline.id, name: pipeline.nome, stagesCount: count ?? 0 };
}

export function useDefaultPipeline() {
  return useQuery<DefaultPipelineInfo | null>({
    queryKey: ["default-pipeline"],
    staleTime: 1000 * 60 * 5,
    queryFn: fetchDefaultProjectPipeline,
  });
}

export function useEnsureDefaultProjectPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const existing = await fetchDefaultProjectPipeline();
      let funilId = existing?.id ?? null;
      let funilName = existing?.name ?? "Comercial";

      if (!funilId) {
        const { data: lastFunil, error: lastFunilError } = await supabase
          .from("projeto_funis")
          .select("ordem")
          .order("ordem", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastFunilError) throw new Error(lastFunilError.message);

        const { data: createdFunil, error: createFunilError } = await supabase
          .from("projeto_funis")
          .insert({ nome: "Comercial", ordem: (lastFunil?.ordem ?? -1) + 1 } as never)
          .select("id, nome")
          .single();

        if (createFunilError) throw new Error(createFunilError.message);
        funilId = createdFunil.id;
        funilName = createdFunil.nome;
      }

      const { count: existingStages, error: countError } = await supabase
        .from("projeto_etapas")
        .select("id", { count: "exact", head: true })
        .eq("funil_id", funilId);
      if (countError) throw new Error(countError.message);

      let stagesCreated = 0;
      if ((existingStages ?? 0) === 0) {
        const { error: createStagesError } = await supabase
          .from("projeto_etapas")
          .insert(DEFAULT_PROJECT_STAGES.map((stage) => ({ ...stage, funil_id: funilId })) as never);
        if (createStagesError) throw new Error(createStagesError.message);
        stagesCreated = DEFAULT_PROJECT_STAGES.length;
      }

      return {
        id: funilId,
        name: funilName,
        stagesCreated,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-pipeline"] });
    },
  });
}
