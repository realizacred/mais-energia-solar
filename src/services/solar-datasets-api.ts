/**
 * Solar Datasets API — thin client layer.
 * All business logic lives server-side; this module only calls our backend endpoints.
 * No external API calls (NASA, INPE) are made from the browser.
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────

export type ImportJobStatus = "queued" | "running" | "success" | "failed";

export interface ImportJob {
  job_id: string;
  dataset_key: string;
  status: ImportJobStatus;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  row_count: number | null;
  created_at: string;
}

export interface ImportJobLog {
  id: string;
  job_id: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

// ─── API Calls ───────────────────────────────────────────────

/**
 * Trigger a new import from the provider's API.
 * POST /api/solar/datasets/{dataset_key}/import
 */
export async function triggerDatasetImport(datasetKey: string): Promise<ImportJob> {
  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { dataset_key: datasetKey },
  });

  if (error) throw new Error(error.message ?? "Falha ao iniciar importação");
  return data as ImportJob;
}

/**
 * Poll the status of an import job.
 * GET /api/solar/import-jobs/{job_id}
 */
export async function getImportJobStatus(jobId: string): Promise<ImportJob> {
  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { action: "status", job_id: jobId },
  });

  if (error) throw new Error(error.message ?? "Falha ao consultar status do job");
  return data as ImportJob;
}

/**
 * Fetch logs for a specific import job.
 * GET /api/solar/import-jobs/{job_id}/logs
 */
export async function getImportJobLogs(jobId: string): Promise<ImportJobLog[]> {
  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { action: "logs", job_id: jobId },
  });

  if (error) throw new Error(error.message ?? "Falha ao buscar logs do job");
  return (data ?? []) as ImportJobLog[];
}
