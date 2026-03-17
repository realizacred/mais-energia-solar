import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConsultorAtivo {
  id: string;
  nome: string;
  user_id: string | null;
  ativo: boolean;
}

/**
 * Shared hook for fetching active consultores.
 * Used by TasksManager, WaInbox, WaSettingsDialog operators tab, etc.
 */
export function useConsultoresAtivos() {
  return useQuery({
    queryKey: ["consultores-ativos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultores")
        .select("id, nome, user_id, ativo")
        .eq("ativo", true)
        .order("nome");
      return (data || []) as ConsultorAtivo[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
