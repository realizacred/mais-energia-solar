import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FN = "tenant-backup";
const QK = ["backup-logs"];

interface BackupLog {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  backup_type: string;
  file_size_bytes: number | null;
  tables_included: string[];
  tables_row_counts: Record<string, number> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
}

async function invoke(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export function useBackupRestore() {
  const qc = useQueryClient();

  const logsQuery = useQuery<BackupLog[]>({
    queryKey: QK,
    queryFn: async () => {
      const data = await invoke({ action: "list" });
      return data.logs || [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const createBackup = useMutation({
    mutationFn: () => invoke({ action: "create" }),
    onSuccess: (data) => {
      toast.success(
        `Backup concluído! ${data.file_size_bytes ? (data.file_size_bytes / 1024 / 1024).toFixed(2) + " MB" : ""}`
      );
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(`Erro ao criar backup: ${e.message}`),
  });

  const downloadBackup = useMutation({
    mutationFn: (backupId: string) => invoke({ action: "download", backup_id: backupId }),
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (e: Error) => toast.error(`Erro ao baixar: ${e.message}`),
  });

  const deleteBackup = useMutation({
    mutationFn: (backupId: string) => invoke({ action: "delete", backup_id: backupId }),
    onSuccess: () => {
      toast.success("Backup removido");
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });

  return {
    logs: logsQuery.data || [],
    isLoading: logsQuery.isLoading,
    refetch: logsQuery.refetch,

    createBackup: createBackup.mutate,
    isCreating: createBackup.isPending,

    downloadBackup: downloadBackup.mutate,
    isDownloading: downloadBackup.isPending,

    deleteBackup: deleteBackup.mutate,
    isDeleting: deleteBackup.isPending,
  };
}
