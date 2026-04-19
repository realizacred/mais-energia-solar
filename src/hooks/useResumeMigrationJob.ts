/**
 * useResumeMigrationJob — Retoma manualmente um job travado (fallback do watchdog).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useResumeMigrationJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("migration-execute-job", {
        body: { job_id: jobId, resume: true },
      });
      if (error) throw new Error(error.message);
      if (data?.error && data?.status !== "running") throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, jobId) => {
      toast({ title: "Job retomado", description: `Execução reiniciada (${jobId.slice(0, 8)}).` });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
      qc.invalidateQueries({ queryKey: ["migration-job-status", jobId] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao retomar", description: e?.message ?? String(e), variant: "destructive" });
    },
  });
}
