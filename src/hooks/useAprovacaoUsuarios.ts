// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface PendingUser {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  cargo_solicitado: string | null;
  status: string;
  created_at: string;
  email?: string;
}

export function usePendingUsers() {
  return useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, nome, ativo, status, cargo_solicitado, telefone, avatar_url, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch emails for pending users
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { data: emailsData } = await supabase.functions.invoke("list-users-emails", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const emailMap = new Map<string, string>();
        if (emailsData?.users && Array.isArray(emailsData.users)) {
          emailsData.users.forEach((u: { id: string; email: string }) => {
            emailMap.set(u.id, u.email);
          });
        }
        return (data || []).map((p) => ({
          ...p,
          email: emailMap.get(p.user_id) || undefined,
        })) as PendingUser[];
      }
      return (data ?? []) as PendingUser[];
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshPendingUsers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pending-users"] });
}
