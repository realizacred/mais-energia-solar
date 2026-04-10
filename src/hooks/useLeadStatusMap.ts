import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadStatusRecord {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

const TERMINAL_NAMES = ["Convertido", "Perdido", "Arquivado", "Aguardando Validação"];

/**
 * Centralized hook to fetch all lead_status records.
 * Provides lookup helpers by ordem (stable) instead of nome (fragile).
 *
 * §16 — queries in hooks only
 * §23 — staleTime obrigatório (static config data = 15 min)
 */
export function useLeadStatusMap() {
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["lead-status-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome, cor, ordem")
        .order("ordem", { ascending: true });

      if (error) {
        console.error("[useLeadStatusMap] Failed to fetch statuses:", error);
        return [];
      }

      //   "[useLeadStatusMap] Available statuses:",
      //   data?.map((s) => `${s.nome} (ordem=${s.ordem}, id=${s.id})`)
      // );
      return (data as LeadStatusRecord[]) || [];
    },
    staleTime: 1000 * 60 * 15, // 15 min — static config
  });

  /** First non-terminal status — used as "reopen" target. */
  const reopenTarget =
    statuses.find((s) => !TERMINAL_NAMES.includes(s.nome)) ?? null;

  return {
    statuses,
    isLoading,
    reopenTarget,
  };
}
