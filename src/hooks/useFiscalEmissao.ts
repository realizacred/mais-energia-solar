/**
 * Hook para dados de FiscalEmissao.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

// ─── Invoices ──────────────────────────
export function useFiscalInvoices() {
  return useQuery({
    queryKey: ["fiscal-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_invoices")
        .select("id, status, status_asaas, service_description, value, effective_date, invoice_number, pdf_url, xml_url, asaas_invoice_id, municipal_service_name, error_message, created_at, cliente_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

// ─── Municipal Services ──────────────────────────
export function useFiscalMunicipalServices() {
  return useQuery({
    queryKey: ["fiscal-municipal-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_municipal_services")
        .select("id, asaas_service_id, service_code, service_name")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 15,
  });
}

// ─── Fiscal Settings (defaults) ──────────────────────────
export function useFiscalSettings() {
  return useQuery({
    queryKey: ["fiscal-settings-defaults"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_settings")
        .select("default_service_description, default_observations, default_taxes, allow_deductions")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15,
  });
}

// ─── Invoice Events ──────────────────────────
export function useFiscalInvoiceEvents(invoiceId: string | null) {
  return useQuery({
    queryKey: ["fiscal-invoice-events", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_invoice_events")
        .select("id, event_type, event_source, old_status, new_status, created_at")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!invoiceId,
    staleTime: 1000 * 30,
  });
}

// ─── Create Invoice Mutation ──────────────────────────
export function useCreateFiscalInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      service_description: string;
      observations: string | null;
      value: number;
      deductions: number;
      effective_date: string;
      municipal_service_id: string | null;
      municipal_service_code: string | null;
      municipal_service_name: string | null;
      taxes: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const { error } = await supabase.from("fiscal_invoices").insert({
        tenant_id: profile.tenant_id,
        ...payload,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
  });
}
