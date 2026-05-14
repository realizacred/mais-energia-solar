import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "gerente" | "financeiro" | "consultor" | "vendas" | "tecnico" | "instalador" | "engenheiro" | "gestor";

export function useUserRole() {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles-list", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      
      if (error) throw error;
      return (data || []).map(r => r.role as AppRole);
    }
  });

  const hasRole = (roleList: AppRole[]) => roles.some(r => roleList.includes(r));

  const isConsultor = roles.some(r => ["consultor", "vendas"].includes(r));
  const isTecnico = roles.some(r => ["tecnico", "instalador", "engenheiro"].includes(r));
  const isAdmin = roles.some(r => ["admin", "gerente", "gestor"].includes(r));

  return {
    roles,
    isLoading,
    isConsultor,
    isTecnico,
    isAdmin,
    hasRole
  };
}
