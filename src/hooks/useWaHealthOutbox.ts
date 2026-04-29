import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaOutboxRow {
  id: string;
  created_at: string;
  status: string;
  remote_jid: string | null;
  error_message: string | null;
  retry_count: number | null;
}

export function useWaHealthOutbox(statusFilter: string = "all") {
  return useQuery<WaOutboxRow[]>({
    queryKey: ["wa-health-outbox", statusFilter],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("wa_outbox")
        .select("id, created_at, status, remote_jid, error_message, retry_count")
        .order("created_at", { ascending: false })
        .limit(50);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WaOutboxRow[];
    },
  });
}
