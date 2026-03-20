/**
 * useUnitCredits — CRUD hook for manual GD credits on a UC.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnitCredit {
  id: string;
  tenant_id: string;
  unit_id: string;
  plant_id: string | null;
  quantidade_kwh: number;
  data_vigencia: string;
  posto_tarifario: string;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCreditPayload {
  unit_id: string;
  tenant_id: string;
  plant_id: string | null;
  quantidade_kwh: number;
  data_vigencia: string;
  posto_tarifario: string;
  observacoes: string | null;
}

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "unit_credits" as const;

export function useUnitCredits(unitId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_credits")
        .select("*")
        .eq("unit_id", unitId!)
        .order("data_vigencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UnitCredit[];
    },
    staleTime: STALE_TIME,
    enabled: !!unitId,
  });
}

export function useCreateUnitCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCreditPayload) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("unit_credits")
        .insert({ ...payload, created_by: user?.id } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as UnitCredit;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.unit_id] });
    },
  });
}

export function useDeleteUnitCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, unitId }: { id: string; unitId: string }) => {
      const { error } = await supabase.from("unit_credits").delete().eq("id", id);
      if (error) throw error;
      return unitId;
    },
    onSuccess: (unitId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, unitId] });
    },
  });
}
