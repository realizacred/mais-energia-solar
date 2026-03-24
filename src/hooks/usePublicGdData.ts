/**
 * usePublicGdData — Hook for fetching GD data via public token.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface PublicGdBeneficiary {
  uc_id: string;
  uc_name: string;
  codigo_uc: string;
  allocation_percent: number;
  priority_order: number | null;
  latest_invoice: {
    consumed_kwh: number;
    compensated_kwh: number;
    injected_kwh: number;
    total_amount: number;
    savings_brl: number;
    balance_kwh: number;
    ref_year: number;
    ref_month: number;
  } | null;
  avg_consumed_kwh: number;
}

export interface PublicGdGeradoraInvoice {
  consumed_kwh: number;
  injected_kwh: number;
  compensated_kwh: number;
  total_amount: number;
  savings_brl: number;
  balance_kwh: number;
  ref_year: number;
  ref_month: number;
}

export interface PublicGdData {
  has_gd: boolean;
  group_id?: string;
  group_name?: string;
  categoria_gd?: string | null;
  uc_geradora_id?: string;
  uc_geradora_name?: string;
  uc_geradora_codigo?: string;
  beneficiaries?: PublicGdBeneficiary[];
  geradora_invoices?: PublicGdGeradoraInvoice[];
  tarifa_kwh?: number;
  current_uc_role?: "geradora" | "beneficiaria";
}

export function usePublicGdData(token: string | null) {
  return useQuery({
    queryKey: ["uc_public_gd_data", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resolve_uc_gd_data", { p_token: token! });
      if (error) throw error;
      const parsed = data as any;
      if (parsed?.error) return { has_gd: false } as PublicGdData;
      return parsed as PublicGdData;
    },
    enabled: !!token,
    staleTime: STALE_TIME,
  });
}
