/**
 * useUCPublicData — Queries para a página pública da UC.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiblingUC {
  unit_id: string;
  unit_name: string;
  codigo_uc: string;
  papel_gd: string | null;
  token: string;
}

export interface ResolvedUC {
  unit_id: string;
  unit_name: string;
  codigo_uc: string;
  concessionaria_nome: string;
  tipo_uc: string;
  tenant_id: string;
  brand: { logo_url?: string; color_primary?: string; company_name?: string };
  ultima_leitura_data?: string | null;
  ultima_leitura_kwh_03?: number | null;
  ultima_leitura_kwh_103?: number | null;
  potencia_kwp?: number | null;
  categoria_gd?: string | null;
  papel_gd?: string | null;
  siblings?: SiblingUC[];
}

export function useUCPublicToken(token: string | undefined) {
  return useQuery({
    queryKey: ["uc_public_token", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_client_token", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) throw new Error(parsed.error);
      return parsed as ResolvedUC;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });
}

export function useUCPublicMonitoring(token: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["uc_public_monitoring", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_monitoring", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) return null;
      return parsed as {
        plants: Array<{ id: string; name: string; installed_power_kwp: number; is_active: boolean; last_seen_at: string | null; provider_id: string; allocation_percent: number }>;
        meters: Array<{ id: string; name: string; model: string; manufacturer: string; serial_number: string; online_status: string | null; last_seen_at: string | null; last_reading_at: string | null }>;
        daily: Array<{ date: string; energy_kwh: number; peak_power_kw: number }>;
        today_kwh: number;
        month_kwh: number;
      };
    },
    enabled: !!token && enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUCPublicInvoices(unitId: string | undefined, year: number) {
  return useQuery({
    queryKey: ["uc_public_invoices", unitId, String(year)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_invoices")
        .select("id, reference_month, reference_year, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, total_amount, bandeira_tarifaria, due_date, has_file, pdf_file_url, current_balance_kwh, previous_balance_kwh, status, estimated_savings_brl")
        .eq("unit_id", unitId!)
        .eq("reference_year", year)
        .order("reference_month", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUCPublicTarifa(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["public_tarifa", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("calculadora_config")
        .select("tarifa_media_kwh")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return data?.tarifa_media_kwh ?? 0.85;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 15,
  });
}
