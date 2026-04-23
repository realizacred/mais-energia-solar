/**
 * useStartMigration — Executa a migração REAL (grava em canônicos).
 *
 * Invoca a edge `sm-promote` com `dry_run=false`. Deve ser chamada APENAS
 * após um dry-run bem-sucedido (validado pela página).
 *
 * Governança:
 *   - RB-04: chamada via hook dedicado
 *   - RB-58: sucesso validado pelo `ok` do response
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StartMigrationResponse {
  ok: boolean;
  job_id: string;
  status: string;
  counters?: Record<string, number>;
  duration_ms?: number;
}

export function useStartMigration() {
  const qc = useQueryClient();
  return useMutation<StartMigrationResponse, Error, { batchSize?: number }>({
    mutationFn: async ({ batchSize = 200 } = {}) => {
      const { data, error } = await supabase.functions.invoke("sm-promote", {
        body: {
          action: "promote-all",
          payload: { batch_limit: batchSize, dry_run: false, scope: "proposta" },
        },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar migração.");
      const resp = data as StartMigrationResponse | { ok: false; error?: string };
      if (!resp || resp.ok === false) {
        throw new Error(
          (resp as { error?: string })?.error ?? "Migração retornou erro.",
        );
      }
      return resp as StartMigrationResponse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-promote", "jobs"] });
      qc.invalidateQueries({ queryKey: ["sm-promote", "totals"] });
      qc.invalidateQueries({ queryKey: ["sm-migracao-stats"] });
    },
  });
}
