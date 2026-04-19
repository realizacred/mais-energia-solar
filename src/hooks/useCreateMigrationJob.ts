/**
 * useCreateMigrationJob — Cria um job e dispara execução (fire-and-forget).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type JobType =
  | "classify_projects"
  | "migrate_clients"
  | "migrate_projects"
  | "migrate_proposals"
  | "full_migration";

export function useCreateMigrationJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job_type: JobType) => {
      const { data, error } = await supabase.functions.invoke("migration-start-job", {
        body: { job_type },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const jobId = data.job_id as string;
      // dispara execução (não bloqueia)
      supabase.functions.invoke("migration-execute-job", { body: { job_id: jobId } }).catch(() => {});
      return jobId;
    },
    onSuccess: (jobId) => {
      toast({ title: "Job criado", description: `Execução iniciada (${jobId.slice(0, 8)}).` });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
    },
    onError: (e: any) => {
      toast({ title: "Falha ao criar job", description: e?.message ?? String(e), variant: "destructive" });
    },
  });
}
