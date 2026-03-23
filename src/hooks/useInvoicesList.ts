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
  cliente_id?: string;
  papel_gd?: string;
}

export function useInvoicesList(filters: InvoiceFilters, page: number) {
  return useQuery({
    queryKey: ["central_invoices", filters, page],
    queryFn: async () => {
      let q = supabase
        .from("unit_invoices")
        .select(
          `id, unit_id, reference_month, reference_year, due_date, total_amount, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, pdf_file_url, source, status, created_at, has_file, units_consumidoras!inner(nome, codigo_uc, concessionaria_nome, cliente_id, papel_gd, clientes(nome))`,
          { count: "exact" }
        )
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });

      if (filters.unit_id) q = q.eq("unit_id", filters.unit_id);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.reference_year) q = q.eq("reference_year", filters.reference_year);
      if (filters.cliente_id) q = q.eq("units_consumidoras.cliente_id", filters.cliente_id);
      if (filters.papel_gd) q = q.eq("units_consumidoras.papel_gd", filters.papel_gd);

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
      // Resolve tenant_id for the RPC call
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      // Aggregation via server-side RPC (no full table scan)
      const { data: kpiData, error: kpiError } = await supabase.rpc(
        "get_invoice_kpis" as any,
        { p_tenant_id: profile.tenant_id }
      );
      if (kpiError) throw kpiError;

      const kpi = (kpiData as any) || {};

      // Current month stats from import jobs (lightweight query)
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
        totalCount: Number(kpi.total_faturas) || 0,
        totalValor: Number(kpi.total_valor) || 0,
        totalKwh: Number(kpi.total_kwh) || 0,
        totalInjetadoKwh: Number(kpi.total_injetado_kwh) || 0,
        mediaValor: Number(kpi.media_valor) || 0,
        faturasPendentes: Number(kpi.faturas_pendentes) || 0,
        faturasErro: Number(kpi.faturas_erro) || 0,
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
