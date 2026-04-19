/**
 * useCancelMigrationJob — Cancela um job pending/running marcando-o como failed.
 * Não faz rollback — apenas interrompe o ciclo (próximo tick do executor sai).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useCancelMigrationJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase as any)
        .from("migration_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: "Cancelado manualmente pelo usuário",
        })
        .eq("id", jobId)
        .in("status", ["pending", "running"]);
      if (error) throw error;
      return jobId;
    },
    onSuccess: () => {
      toast({ title: "Job cancelado", description: "A execução será interrompida." });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
      qc.invalidateQueries({ queryKey: ["migration-job-status"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao cancelar", description: e?.message ?? String(e), variant: "destructive" });
    },
  });
}
