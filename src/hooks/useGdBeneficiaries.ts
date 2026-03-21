/**
 * useGdBeneficiaries — Hooks for GD Group Beneficiaries.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

const STALE_TIME = 1000 * 60 * 5;
const QK = "gd_group_beneficiaries" as const;

export interface GdBeneficiary {
  id: string;
  tenant_id: string;
  gd_group_id: string;
  uc_beneficiaria_id: string;
  allocation_type: string;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  priority_order: number | null;
  allow_overflow_in: boolean;
  allow_overflow_out: boolean;
  created_at: string;
  updated_at: string;
}

export function useGdBeneficiaries(groupId: string | null) {
  return useQuery({
    queryKey: [QK, groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from("gd_group_beneficiaries")
        .select("*")
        .eq("gd_group_id", groupId)
        .order("created_at");
      if (error) throw error;
      return data as GdBeneficiary[];
    },
    staleTime: STALE_TIME,
    enabled: !!groupId,
  });
}

/** Get all GD beneficiary records for a specific UC */
export function useGdBeneficiariesByUC(ucId: string | null) {
  return useQuery({
    queryKey: [QK, "by_uc", ucId],
    queryFn: async () => {
      if (!ucId) return [];
      const { data, error } = await supabase
        .from("gd_group_beneficiaries")
        .select("*, gd_groups!inner(id, nome, uc_geradora_id, status)")
        .eq("uc_beneficiaria_id", ucId)
        .eq("is_active", true);
      if (error) throw error;
      return data as (GdBeneficiary & { gd_groups: { id: string; nome: string; uc_geradora_id: string; status: string } })[];
    },
    staleTime: STALE_TIME,
    enabled: !!ucId,
  });
}

/** Get GD group where this UC is the generator */
export function useGdGroupByGenerator(ucId: string | null) {
  return useQuery({
    queryKey: ["gd_groups", "by_generator", ucId],
    queryFn: async () => {
      if (!ucId) return [];
      const { data, error } = await supabase
        .from("gd_groups")
        .select("*")
        .eq("uc_geradora_id", ucId)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!ucId,
  });
}

export function useSaveGdBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GdBeneficiary> & { id?: string }) => {
      const { tenantId } = await getCurrentTenantId();
      const { id, ...rest } = payload;
      if (id) {
        const { data, error } = await supabase
          .from("gd_group_beneficiaries")
          .update(rest as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("gd_group_beneficiaries")
          .insert({ ...rest, tenant_id: tenantId } as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["gd_groups"] });
    },
  });
}

export function useDeleteGdBeneficiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gd_group_beneficiaries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}
