/**
 * useDryRunMigration — Simulação completa da migração SolarMarket.
 *
 * Invoca a edge `sm-promote` com `dry_run=true`. A função executa toda a
 * resolução (consultor, pipeline, stage, gate de elegibilidade) por candidato
 * e retorna um relatório agregado SEM gravar nada nos canônicos.
 *
 * Governança:
 *   - RB-04: chamada via hook dedicado
 *   - RB-58: sucesso é validado pelo `ok` do response
 */
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DryRunReport {
  total_candidatos: number;
  clientes_a_criar: number;
  projetos_a_criar: number;
  propostas_a_criar: number;
  distribuicaoPorPipeline: Record<string, number>;
  distribuicaoPorConsultor: Record<string, number>;
  distribuicaoPorStage: Record<string, number>;
  distribuicaoPorStatus: Record<string, number>;
  bloqueados: Array<{ tipo: string; external_id: string | null; motivos: string[] }>;
  warnings: Array<{ tipo: string; external_id: string | null; mensagem: string }>;
}

export interface DryRunResponse {
  ok: boolean;
  job_id: string;
  status: string;
  dry_run: true;
  candidates: number;
  report: DryRunReport;
}

export function useDryRunMigration() {
  return useMutation<DryRunResponse, Error, { batchSize?: number }>({
    mutationFn: async ({ batchSize = 5000 } = {}) => {
      const { data, error } = await supabase.functions.invoke("sm-promote", {
        body: {
          action: "promote-all",
          payload: { batch_limit: batchSize, dry_run: true, scope: "proposta" },
        },
      });
      if (error) throw new Error(error.message || "Falha ao executar dry-run.");
      const resp = data as DryRunResponse | { ok: false; error?: string };
      if (!resp || resp.ok === false) {
        throw new Error(
          (resp as { error?: string })?.error ?? "Dry-run retornou erro.",
        );
      }
      return resp as DryRunResponse;
    },
  });
}
