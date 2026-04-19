/**
 * useMigrationRollback — Reverte um job (deleta dados nativos migrados).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useMigrationRollback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("migration-rollback", {
        body: { job_id: jobId, confirm: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Rollback concluído", description: "Dados migrados foram revertidos." });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
      qc.invalidateQueries({ queryKey: ["migration-job-status"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha no rollback", description: e?.message ?? String(e), variant: "destructive" });
    },
  });
}
