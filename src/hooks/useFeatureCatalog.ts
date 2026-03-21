/**
 * useFeatureCatalog — CRUD for feature_flags_catalog.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15;
const QK = "feature_flags_catalog" as const;

export interface FeatureFlag {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags_catalog")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FeatureFlag[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FeatureFlag> & { feature_key: string; name: string }) => {
      const { id, created_at, updated_at, ...rest } = payload as any;
      if (id) {
        const { data, error } = await supabase
          .from("feature_flags_catalog")
          .update(rest)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("feature_flags_catalog")
          .insert(rest)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}

export function useToggleFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("feature_flags_catalog")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK] }),
  });
}
