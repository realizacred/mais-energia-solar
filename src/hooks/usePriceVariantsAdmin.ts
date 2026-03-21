/**
 * usePriceVariantsAdmin — CRUD for price_variants table.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "price-variants-admin" as const;

export interface PriceVariantRow {
  id: string;
  plan_id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  is_active: boolean;
  weight: number;
  created_at: string;
}

export function usePriceVariantsAdmin() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_variants")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceVariantRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSavePriceVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<PriceVariantRow> & { plan_id: string; name: string; price_monthly: number },
    ) => {
      const { id, created_at, ...rest } = payload as any;
      if (id) {
        const { data, error } = await supabase
          .from("price_variants")
          .update(rest)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("price_variants")
          .insert(rest)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["pricing-dashboard-metrics"] });
    },
  });
}

export function useTogglePriceVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("price_variants")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["pricing-dashboard-metrics"] });
    },
  });
}
