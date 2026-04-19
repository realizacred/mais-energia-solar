/**
 * useClearMigrationHistory — Limpa o histórico de jobs de migração.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useClearMigrationHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scope: "finished" | "all" = "finished") => {
      const { data, error } = await supabase.functions.invoke("migration-clear-history", {
        body: { scope },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { deleted_jobs: number; deleted_steps: number };
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
