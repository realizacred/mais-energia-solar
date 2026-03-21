import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const QK = ["storage-management"];
const STALE_TIME = 1000 * 60 * 5;

interface TableStorageInfo {
  table_name: string;
  row_count: number;
  total_size: string;
  retention_days: number;
}

interface PurgeResult {
  payloads_deleted: number;
  webhooks_deleted: number;
  executed_at: string;
}

export function useStorageManagement() {
  const qc = useQueryClient();

  const storageQuery = useQuery<TableStorageInfo[]>({
    queryKey: QK,
    queryFn: async () => {
      const results: TableStorageInfo[] = [];

      // monitor_provider_payloads
      const { count: payloadCount } = await supabase
        .from("monitor_provider_payloads")
        .select("id", { count: "exact", head: true });

      results.push({
        table_name: "monitor_provider_payloads",
        row_count: payloadCount ?? 0,
        total_size: estimateSize(payloadCount ?? 0, 3.7),
        retention_days: 7,
      });

      // wa_webhook_events
      const { count: webhookCount } = await supabase
        .from("wa_webhook_events")
        .select("id", { count: "exact", head: true });

      results.push({
        table_name: "wa_webhook_events",
        row_count: webhookCount ?? 0,
        total_size: estimateSize(webhookCount ?? 0, 56.7), // ~56.7 KB/row based on 830MB/15K
        retention_days: 14,
      });

      return results;
    },
    staleTime: STALE_TIME,
  });

  const executePurge = useMutation<PurgeResult>({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purge_old_payloads" as never);
      if (error) throw error;
      return data as unknown as PurgeResult;
    },
    onSuccess: (data) => {
      const total = (data.payloads_deleted || 0) + (data.webhooks_deleted || 0);
      toast.success(`Purge concluído! ${total.toLocaleString("pt-BR")} registros removidos`);
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(`Erro no purge: ${e.message}`),
  });

  return {
    tables: storageQuery.data ?? [],
    isLoading: storageQuery.isLoading,
    refetch: storageQuery.refetch,
    executePurge: executePurge.mutate,
    isPurging: executePurge.isPending,
    purgeResult: executePurge.data ?? null,
  };
}

function estimateSize(rows: number, kbPerRow: number): string {
  const totalMB = (rows * kbPerRow) / 1024;
  if (totalMB < 1) return `${(rows * kbPerRow).toFixed(0)} KB`;
  if (totalMB > 1024) return `${(totalMB / 1024).toFixed(2)} GB`;
  return `${totalMB.toFixed(1)} MB`;
}
