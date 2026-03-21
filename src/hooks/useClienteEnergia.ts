/**
 * useClienteEnergia — Hooks for client energy data (UCs, GD groups, invoices).
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

/** UCs linked to a client */
export function useClienteUCs(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-ucs", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, tipo_uc, papel_gd, categoria_gd, concessionaria_id, status, is_archived")
        .eq("cliente_id", clienteId)
        .eq("is_archived", false)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** GD groups linked to a client */
export function useClienteGdGroups(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-gd-groups", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("gd_groups")
        .select("id, nome, status, uc_geradora_id, concessionaria_id")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** Invoice count per UC for a set of UC ids */
export function useClienteInvoiceSummary(ucIds: string[]) {
  return useQuery({
    queryKey: ["cliente-invoice-summary", ucIds],
    queryFn: async () => {
      if (ucIds.length === 0) return [];
      const { data, error } = await supabase
        .from("unit_invoices")
        .select("unit_id, total_amount")
        .in("unit_id", ucIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: ucIds.length > 0,
  });
}
