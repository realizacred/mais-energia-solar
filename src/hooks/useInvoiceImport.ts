/**
 * Hooks for invoice import jobs.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceImportService, type InvoiceImportJob, type InvoiceImportJobItem } from "@/services/invoiceImportService";

const STALE_TIME = 1000 * 60 * 5;
const STALE_TIME_ACTIVE = 1000 * 5; // 5s for active jobs

export function useInvoiceImportJobs(limit = 10) {
  return useQuery({
    queryKey: ["invoice_import_jobs", limit],
    queryFn: () => invoiceImportService.listJobs(limit),
    staleTime: STALE_TIME,
  });
}

export function useInvoiceImportJobItems(jobId: string | null) {
  return useQuery({
    queryKey: ["invoice_import_job_items", jobId],
    queryFn: () => invoiceImportService.listJobItems(jobId!),
    staleTime: STALE_TIME_ACTIVE,
    enabled: !!jobId,
  });
}

export function useActiveImportJob() {
  return useQuery({
    queryKey: ["invoice_import_jobs_active"],
    queryFn: async () => {
      const jobs = await invoiceImportService.listJobs(1);
      const active = jobs.find((j) => j.status === "processing" || j.status === "queued");
      return active || null;
    },
    staleTime: STALE_TIME_ACTIVE,
    refetchInterval: (query) => {
      // Poll every 3s while there's an active job
      return query.state.data ? 3000 : false;
    },
  });
}

export function useStartInvoiceImport() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ files, unitId }: { files: File[]; unitId?: string }) => {
      const job = await invoiceImportService.createJob(files.length, "upload");
      let success = 0;
      let duplicate = 0;
      let errors = 0;
      const enrichedUcs: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const result = await invoiceImportService.processFile(job.id, files[i], unitId);

        if (result.status === "imported") success++;
        else if (result.status === "duplicate") duplicate++;
        else errors++;

        // Update job progress incrementally
        await invoiceImportService.updateJobProgress(job.id, {
          processed_files: i + 1,
          success_count: success,
          duplicate_count: duplicate,
          error_count: errors,
        } as any);

        // Invalidate to update UI in real-time
        qc.invalidateQueries({ queryKey: ["invoice_import_jobs"] });
        qc.invalidateQueries({ queryKey: ["invoice_import_jobs_active"] });
      }

      await invoiceImportService.finalizeJob(job.id, { success, duplicate, errors, enriched_ucs: enrichedUcs });
      return { jobId: job.id, success, duplicate, errors };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice_import_jobs"] });
      qc.invalidateQueries({ queryKey: ["invoice_import_jobs_active"] });
      qc.invalidateQueries({ queryKey: ["central_invoices"] });
      qc.invalidateQueries({ queryKey: ["unit_invoices"] });
    },
  });
}
