/**
 * InvoiceImportService — Persistent job-based invoice import with UC enrichment.
 * SSOT for import job lifecycle.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { invoiceService } from "@/services/invoiceService";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { uploadInvoiceTempPdf } from "@/services/invoiceUploadService";

export type ImportJobStatus = "queued" | "processing" | "completed" | "failed" | "partial";
export type ImportItemStatus = "processing" | "imported" | "duplicate" | "failed";

export interface InvoiceImportJob {
  id: string;
  tenant_id: string;
  source: string;
  status: ImportJobStatus;
  total_files: number;
  processed_files: number;
  success_count: number;
  duplicate_count: number;
  error_count: number;
  created_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  summary_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceImportJobItem {
  id: string;
  job_id: string;
  file_name: string;
  unit_id: string | null;
  reference_year: number | null;
  reference_month: number | null;
  status: ImportItemStatus;
  error_message: string | null;
  parser_summary_json: Record<string, unknown> | null;
  invoice_id: string | null;
  created_at: string;
}

const JOB_COLS = `id, tenant_id, source, status, total_files, processed_files, success_count, duplicate_count, error_count, created_by, started_at, finished_at, summary_json, created_at, updated_at`;
const ITEM_COLS = `id, job_id, file_name, unit_id, reference_year, reference_month, status, error_message, parser_summary_json, invoice_id, created_at, updated_at`;

// Fields eligible for UC enrichment from parsed invoice data
const UC_ENRICHABLE_FIELDS: Record<string, string> = {
  concessionaria_nome: "concessionaria",
  classificacao_grupo: "grupo_tarifario",
  classificacao_subgrupo: "subgrupo_tarifario",
  modalidade_tarifaria: "modalidade_tarifaria",
};

export const invoiceImportService = {
  /** Create a new import job */
  async createJob(totalFiles: number, source = "upload"): Promise<InvoiceImportJob> {
    const { userId } = await getCurrentTenantId();
    const { data, error } = await (supabase as any)
      .from("invoice_import_jobs")
      .insert({
        total_files: totalFiles,
        source,
        status: "processing",
        started_at: new Date().toISOString(),
        created_by: userId,
      })
      .select(JOB_COLS)
      .single();
    if (error) throw error;
    return data as InvoiceImportJob;
  },

  /** Update job progress */
  async updateJobProgress(jobId: string, updates: Partial<InvoiceImportJob>) {
    const { error } = await (supabase as any)
      .from("invoice_import_jobs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (error) throw error;
  },

  /** Finalize a job */
  async finalizeJob(jobId: string, summary: { success: number; duplicate: number; errors: number; enriched_ucs?: string[] }) {
    const status: ImportJobStatus = summary.errors > 0 && summary.success === 0 ? "failed"
      : summary.errors > 0 ? "partial" : "completed";
    await this.updateJobProgress(jobId, {
      status,
      success_count: summary.success,
      duplicate_count: summary.duplicate,
      error_count: summary.errors,
      finished_at: new Date().toISOString(),
      summary_json: summary as any,
    } as any);
  },

  /** Create a job item */
  async createJobItem(jobId: string, fileName: string): Promise<InvoiceImportJobItem> {
    const { data, error } = await (supabase as any)
      .from("invoice_import_job_items")
      .insert({ job_id: jobId, file_name: fileName, status: "processing" })
      .select(ITEM_COLS)
      .single();
    if (error) throw error;
    return data as InvoiceImportJobItem;
  },

  /** Update a job item */
  async updateJobItem(itemId: string, updates: Partial<InvoiceImportJobItem>) {
    const { error } = await (supabase as any)
      .from("invoice_import_job_items")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) throw error;
  },

  /** List recent jobs */
  async listJobs(limit = 10): Promise<InvoiceImportJob[]> {
    const { data, error } = await (supabase as any)
      .from("invoice_import_jobs")
      .select(JOB_COLS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as InvoiceImportJob[];
  },

  /** List items for a job */
  async listJobItems(jobId: string): Promise<InvoiceImportJobItem[]> {
    const { data, error } = await (supabase as any)
      .from("invoice_import_job_items")
      .select(ITEM_COLS)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []) as InvoiceImportJobItem[];
  },

  /** Process a single file within a job — calls edge function, handles duplicates, enriches UC */
  async processFile(
    jobId: string,
    file: File,
    unitId?: string,
  ): Promise<{ status: ImportItemStatus; error?: string }> {
    const item = await this.createJobItem(jobId, file.name);

    try {
      // Convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const pdfBase64 = btoa(binary);

      // Call edge function
      const { data, error } = await supabase.functions.invoke("process-fatura-pdf", {
        body: { pdf_base64: pdfBase64, unit_id: unitId, source: "upload" },
        headers: { "x-client-timeout": "120" },
      });

      if (error) {
        const parsedError = await parseInvokeError(error);
        throw new Error(parsedError.message || "Erro ao processar fatura");
      }
      if (data?.error) throw new Error(data.error);

      const parsed = data?.data?.parsed;
      const invoiceId = data?.data?.invoice_id;
      const resolvedUnitId = data?.data?.unit_id;

      // Check duplicate
      if (resolvedUnitId && parsed) {
        const refMonth = parsed.mes_referencia ? this._extractMonth(parsed.mes_referencia) : null;
        const refYear = parsed.mes_referencia ? this._extractYear(parsed.mes_referencia) : null;

        if (refMonth && refYear) {
          const isDuplicate = await invoiceService.checkDuplicate(resolvedUnitId, refMonth, refYear);
          // If the edge function already inserted AND it's a duplicate, we mark it
          // The edge function doesn't check duplicates, so we check post-hoc
          if (isDuplicate && !invoiceId) {
            await this.updateJobItem(item.id, {
              status: "duplicate",
              unit_id: resolvedUnitId,
              reference_year: refYear,
              reference_month: refMonth,
              parser_summary_json: parsed,
            } as any);
            return { status: "duplicate" };
          }
        }

        // Enrich UC with first-import data
        if (resolvedUnitId && parsed) {
          await this._enrichUC(resolvedUnitId, parsed);
        }

        await this.updateJobItem(item.id, {
          status: "imported",
          unit_id: resolvedUnitId,
          reference_year: refYear,
          reference_month: refMonth,
          invoice_id: invoiceId,
          parser_summary_json: parsed,
        } as any);
        return { status: "imported" };
      }

      await this.updateJobItem(item.id, {
        status: "imported",
        invoice_id: invoiceId,
        parser_summary_json: parsed,
      } as any);
      return { status: "imported" };
    } catch (err: any) {
      await this.updateJobItem(item.id, {
        status: "failed",
        error_message: err?.message || "Erro desconhecido",
      } as any);
      return { status: "failed", error: err?.message };
    }
  },

  /** Enrich UC with parsed invoice data — only fill empty fields */
  async _enrichUC(unitId: string, parsed: Record<string, any>) {
    try {
      const { data: uc } = await supabase
        .from("units_consumidoras")
        .select("id, concessionaria_nome, classificacao_grupo, classificacao_subgrupo, modalidade_tarifaria, nome, endereco")
        .eq("id", unitId)
        .single();

      if (!uc) return;

      const updates: Record<string, any> = {};

      // Only fill empty fields
      for (const [ucField, parsedField] of Object.entries(UC_ENRICHABLE_FIELDS)) {
        const currentVal = (uc as any)[ucField];
        const parsedVal = parsed[parsedField];
        if ((!currentVal || currentVal === "") && parsedVal) {
          updates[ucField] = parsedVal;
        }
      }

      // Address enrichment (only if current address is empty/default)
      const currentAddr = uc.endereco as any;
      const hasAddress = currentAddr && (currentAddr.rua || currentAddr.logradouro || currentAddr.cidade);
      if (!hasAddress && parsed.endereco) {
        updates.endereco = typeof parsed.endereco === "string"
          ? { logradouro: parsed.endereco }
          : parsed.endereco;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase
          .from("units_consumidoras")
          .update(updates as any)
          .eq("id", unitId);
      }
    } catch (err) {
      console.warn("[invoiceImportService] UC enrichment error:", err);
    }
  },

  _extractMonth(mesRef: string): number | null {
    const meses: Record<string, number> = {
      JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
      JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
    };
    const upper = mesRef.toUpperCase();
    for (const [key, val] of Object.entries(meses)) {
      if (upper.includes(key)) return val;
    }
    const match = mesRef.match(/^(\d{2})\//);
    if (match) return parseInt(match[1]);
    return null;
  },

  _extractYear(mesRef: string): number | null {
    const match = mesRef.match(/(\d{4})/);
    if (match) return parseInt(match[1]);
    const match2 = mesRef.match(/(\d{2})$/);
    if (match2) return 2000 + parseInt(match2[1]);
    return null;
  },
};
