/**
 * useGdGroups — Hooks for GD Groups CRUD.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

const STALE_TIME = 1000 * 60 * 5;
const QK = "gd_groups" as const;

export interface GdGroup {
  id: string;
  tenant_id: string;
  cliente_id: string | null;
  nome: string;
  concessionaria_id: string;
  uc_geradora_id: string;
  status: string;
  notes: string | null;
  categoria_gd: string | null;
  created_at: string;
  updated_at: string;
}

export function useGdGroups() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gd_groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GdGroup[];
    },
    staleTime: STALE_TIME,
  });
}

export function useGdGroupById(id: string | null) {
  return useQuery({
    queryKey: [QK, "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("gd_groups")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as GdGroup;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useSaveGdGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GdGroup> & { id?: string }) => {
      const { tenantId } = await getCurrentTenantId();
      const { id, ...rest } = payload;
      if (id) {
        const { data, error } = await supabase
          .from("gd_groups")
          .update(rest as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("gd_groups")
          .insert({ ...rest, tenant_id: tenantId } as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

export function useDeleteGdGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gd_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}
