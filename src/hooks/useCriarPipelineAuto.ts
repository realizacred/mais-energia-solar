/**
 * useCriarPipelineAuto — cria um pipeline nativo a partir de um funil do
 * staging do SolarMarket, replicando todas as etapas e gerando os
 * mapeamentos automáticos. Atalho "Criar automaticamente" do Step 2.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Input {
  tenantId: string;
  smFunilName: string;
}

interface Result {
  ok: boolean;
  pipelineId: string;
  pipelineName: string;
  qtdStages: number;
  qtdMapeamentos: number;
  error?: string;
}

export function useCriarPipelineAuto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, smFunilName }: Input): Promise<Result> => {
      const { data, error } = await supabase.functions.invoke<Result>(
        "sm-criar-pipeline-auto",
        { body: { tenantId, smFunilName } },
      );
      // Mesmo com HTTP 500, o supabase-js pode trazer o body em `data`
      if (data && data.ok === false && data.error) {
        throw new Error(data.error);
      }
      if (error) {
        const { parseEdgeFunctionError } = await import("@/lib/parseEdgeFunctionError");
        const msg = await parseEdgeFunctionError(error, "Falha ao criar pipeline");
        throw new Error(msg);
      }
      if (!data?.ok) throw new Error(data?.error || "Falha ao criar pipeline");
      return data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["sm-funis-staging", vars.tenantId] });
      qc.invalidateQueries({ queryKey: ["pipelines-crm", vars.tenantId] });
      qc.invalidateQueries({ queryKey: ["sm-funil-map"] });
      toast.success(
        `Pipeline "${data.pipelineName}" criado com ${data.qtdStages} etapas`,
      );
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Erro ao criar pipeline";
      toast.error(msg);
    },
  });
}
