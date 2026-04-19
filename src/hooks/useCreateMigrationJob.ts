/**
 * useCreateMigrationJob — Cria um job e dispara execução (fire-and-forget).
 *
 * Aceita `tenant_id` explícito (RB-80): super-admin pode operar em outro tenant.
 * Quando ausente, o backend resolve via JWT do usuário.
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

export interface CreateJobInput {
  job_type: JobType;
  tenant_id?: string | null;
}

export function useCreateMigrationJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const body: Record<string, unknown> = { job_type: input.job_type };
      if (input.tenant_id) body.tenant_id = input.tenant_id;

      const { data, error } = await supabase.functions.invoke("migration-start-job", {
        body,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const jobId = data.job_id as string;
      // dispara execução (não bloqueia)
      supabase.functions
        .invoke("migration-execute-job", { body: { job_id: jobId } })
        .catch(() => {});
      return jobId;
    },
    onSuccess: (jobId) => {
      toast({ title: "Job criado", description: `Execução iniciada (${jobId.slice(0, 8)}).` });
      qc.invalidateQueries({ queryKey: ["migration-jobs"] });
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao criar job",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });
}
