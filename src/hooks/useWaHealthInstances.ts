import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaHealthInstance {
  id: string;
  nome: string;
  status: string;
  phone_number: string | null;
  last_seen_at: string | null;
  offline_minutes: number | null;
}

export function useWaHealthInstances() {
  return useQuery<WaHealthInstance[]>({
    queryKey: ["wa-health-instances"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_instances")
        .select("id, nome, status, phone_number, last_seen_at");
      if (error) throw error;
      const now = Date.now();
      const enriched: WaHealthInstance[] = (data ?? []).map((i: any) => {
        const offline = i.last_seen_at
          ? Math.max(0, Math.floor((now - new Date(i.last_seen_at).getTime()) / 60000))
          : null;
        return {
          id: i.id,
          nome: i.nome,
          status: i.status,
          phone_number: i.phone_number,
          last_seen_at: i.last_seen_at,
          offline_minutes: offline,
        };
      });
      // Críticas primeiro: sem last_seen ou maior offline
      enriched.sort((a, b) => {
        const av = a.offline_minutes ?? Number.MAX_SAFE_INTEGER;
        const bv = b.offline_minutes ?? Number.MAX_SAFE_INTEGER;
        return bv - av;
      });
      return enriched;
    },
  });
}
