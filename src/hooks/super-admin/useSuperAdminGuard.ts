/**
 * useSuperAdminGuard — Centraliza verificação de role super_admin.
 * SSOT para qualquer página/componente do módulo Super Admin.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 5;

export function useSuperAdminGuard() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ["super-admin-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return !!data?.some((r) => r.role === "super_admin");
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
  });

  return {
    user,
    isSuperAdmin: query.data ?? false,
    isChecking: authLoading || query.isLoading,
  };
}
