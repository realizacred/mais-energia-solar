/**
 * Hook for paginated central invoices list.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const PAGE_SIZE = 50;

export interface InvoiceFilters {
  unit_id?: string;
  status?: string;
  reference_year?: number;
  search?: string;
}

export function useInvoicesList(filters: InvoiceFilters, page: number) {
  return useQuery({
    queryKey: ["central_invoices", filters, page],
    queryFn: async () => {
      let q = supabase
        .from("unit_invoices")
        .select(
          `id, unit_id, reference_month, reference_year, due_date, total_amount, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, pdf_file_url, source, status, created_at, has_file, units_consumidoras!inner(nome, codigo_uc, concessionaria_nome, cliente_id)`,
          { count: "exact" }
        )
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });

      if (filters.unit_id) q = q.eq("unit_id", filters.unit_id);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.reference_year) q = q.eq("reference_year", filters.reference_year);

      const from = page * PAGE_SIZE;
      q = q.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      let results = data || [];

      // Client-side text search (UC name, code, concessionaria)
      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((inv: any) => {
          const ucName = inv.units_consumidoras?.nome?.toLowerCase() || "";
          const ucCode = inv.units_consumidoras?.codigo_uc?.toLowerCase() || "";
          const conc = inv.units_consumidoras?.concessionaria_nome?.toLowerCase() || "";
          return ucName.includes(s) || ucCode.includes(s) || conc.includes(s);
        });
      }

      return { data: results, totalCount: count ?? 0, pageSize: PAGE_SIZE };
    },
    staleTime: STALE_TIME,
  });
}

export function useInvoiceKPIs() {
  return useQuery({
    queryKey: ["invoice_kpis"],
    queryFn: async () => {
      // Total invoices count + value
      const { count: totalCount } = await supabase
        .from("unit_invoices")
        .select("id", { count: "exact", head: true });

      const { data: sumData } = await supabase
        .from("unit_invoices")
        .select("total_amount");

      const totalValor = (sumData || []).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

      // Current month stats from import jobs
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      const { data: monthJobs } = await supabase
        .from("invoice_import_jobs")
        .select("success_count, duplicate_count, error_count")
        .gte("created_at", monthStart);

      const monthImported = (monthJobs || []).reduce((s, j) => s + (j.success_count || 0), 0);
      const monthDuplicate = (monthJobs || []).reduce((s, j) => s + (j.duplicate_count || 0), 0);
      const monthErrors = (monthJobs || []).reduce((s, j) => s + (j.error_count || 0), 0);

      return {
        totalCount: totalCount ?? 0,
        totalValor,
        monthImported,
        monthDuplicate,
        monthErrors,
      };
    },
    staleTime: STALE_TIME,
  });
}

export function useInvoiceReviewItems() {
  return useQuery({
    queryKey: ["invoice_review_items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_import_job_items")
        .select("id, job_id, file_name, unit_id, reference_year, reference_month, status, error_message, parser_summary_json, invoice_id, created_at, updated_at")
        .in("status", ["failed"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}
