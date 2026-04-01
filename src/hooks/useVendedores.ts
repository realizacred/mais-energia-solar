import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useVendedoresList() {
  return useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, telefone, email, codigo, slug, ativo, user_id, created_at, percentual_comissao")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useUserProfiles() {
  return useQuery({
    queryKey: ["user-profiles-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshVendedores() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["vendedores-list"] });
}
