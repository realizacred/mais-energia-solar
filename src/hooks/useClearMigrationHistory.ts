/**
 * useClearMigrationHistory — Limpa o histórico de jobs de migração.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "@/hooks/use-toast";

export function useClearMigrationHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scope: "finished" | "all" = "finished") => {
      try {
        const data = await invokeEdgeFunction<{ deleted_jobs: number; deleted_steps: number; error?: string }>(
          "migration-clear-history",
          { body: { scope } },
        );
        if (data?.error) throw new Error(data.error);
        return data;
      } catch (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message);
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Histórico limpo",
        description: `${data.deleted_jobs} job(s) e ${data.deleted_steps} step(s) removidos.`,
      });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
      qc.invalidateQueries({ queryKey: ["migration-job-status"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao limpar", description: e?.message ?? String(e), variant: "destructive" });
    },
  });
}
