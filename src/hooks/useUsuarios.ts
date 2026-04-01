import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-is-admin", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).some((r) => r.role === "admin");
    },
    enabled: !!userId,
    staleTime: STALE_TIME,
  });
}

export interface UserWithRoles {
  user_id: string;
  nome: string;
  email?: string;
  ativo: boolean;
  roles: string[];
  created_at?: string;
  last_sign_in_at?: string | null;
}

export function useUsuariosList(enabled: boolean) {
  return useQuery({
    queryKey: ["usuarios-list"],
    queryFn: async () => {
      const [profilesRes, rolesRes, emailsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome, ativo, created_at").order("nome"),
        supabase.from("user_roles").select("id, user_id, role, created_at, created_by"),
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              return await supabase.functions.invoke("list-users-emails", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
            }
          } catch (e) {
            console.warn("[useUsuarios] Could not fetch user emails:", e);
          }
          return null;
        })(),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const profiles = profilesRes.data;
      const roles = rolesRes.data;
      const emailMap: Record<string, string> = emailsRes?.data?.emails || {};
      const lastSignInMap: Record<string, string | null> = emailsRes?.data?.last_sign_in || {};

      return (profiles || []).map((profile) => ({
        ...profile,
        email: emailMap[profile.user_id] || undefined,
        last_sign_in_at: lastSignInMap[profile.user_id] ?? null,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.user_id)
          .map((r) => r.role),
      })) as UserWithRoles[];
    },
    enabled,
    staleTime: STALE_TIME,
  });
}

export function useRefreshUsuarios() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["usuarios-list"] });
}
