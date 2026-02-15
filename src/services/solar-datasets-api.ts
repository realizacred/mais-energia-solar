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

// ─── Error classification ────────────────────────────────────

export class EdgeFunctionNotDeployedError extends Error {
  constructor() {
    super("Backend import service (solar-dataset-import) não está implantado.");
    this.name = "EdgeFunctionNotDeployedError";
  }
}

/**
 * Detects common Supabase error shapes when an edge function doesn't exist.
 * FunctionsHttpError with 404/500 or FunctionsRelayError are typical signals.
 */
function classifyError(error: any): Error {
  const msg = String(error?.message ?? error ?? "").toLowerCase();
  if (
    msg.includes("function not found") ||
    msg.includes("404") ||
    msg.includes("relay error") ||
    msg.includes("non-2xx") ||
    msg.includes("boot error") ||
    msg.includes("failed to find function") ||
    msg.includes("failed to send a request to the edge function")
  ) {
    return new EdgeFunctionNotDeployedError();
  }
  return new Error(error?.message ?? "Falha na chamada ao backend");
}

// ─── Idempotency ─────────────────────────────────────────────

/** Generates a deterministic-enough key: dataset + ISO minute + random suffix */
export function generateIdempotencyKey(datasetKey: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 16); // 2026-02-15T14-30
  const rand = crypto.randomUUID().substring(0, 8);
  return `${datasetKey}_${ts}_${rand}`;
}

// ─── API Calls ───────────────────────────────────────────────

/**
 * Trigger a new import from the provider's API.
 * Payload: { dataset_key, idempotency_key }
 */
export async function triggerDatasetImport(datasetKey: string): Promise<ImportJob> {
  const idempotency_key = generateIdempotencyKey(datasetKey);

  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { dataset_key: datasetKey, idempotency_key },
  });

  if (error) throw classifyError(error);
  return data as ImportJob;
}

/**
 * Poll the status of an import job.
 * Payload: { action: "status", job_id }
 */
export async function getImportJobStatus(jobId: string): Promise<ImportJob> {
  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { action: "status", job_id: jobId },
  });

  if (error) throw classifyError(error);
  return data as ImportJob;
}

/**
 * Fetch logs for a specific import job.
 * Payload: { action: "logs", job_id }
 */
export async function getImportJobLogs(jobId: string): Promise<ImportJobLog[]> {
  const { data, error } = await supabase.functions.invoke("solar-dataset-import", {
    body: { action: "logs", job_id: jobId },
  });

  if (error) throw classifyError(error);
  return (data ?? []) as ImportJobLog[];
}

// ─── Polling helpers ─────────────────────────────────────────

const BACKOFF_SCHEDULE_MS = [3000, 5000, 8000] as const;

/** Returns the delay for a given poll attempt index (clamped to last value). */
export function getBackoffDelay(attempt: number): number {
  return BACKOFF_SCHEDULE_MS[Math.min(attempt, BACKOFF_SCHEDULE_MS.length - 1)];
}
