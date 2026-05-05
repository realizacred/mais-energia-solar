/**
 * useUserRoles — hook compartilhado para consultar roles do usuário atual.
 * §16: queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 15;

export function useUserRoles() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
    staleTime: STALE_TIME,
    enabled: !!user?.id,
  });

  const roles = query.data ?? [];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isLoading: query.isLoading,
  };
}
