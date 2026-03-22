// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingUser[];
    },
    staleTime: STALE_TIME,
  });
}
