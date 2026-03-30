/**
 * useEdeltecSync — Mutation para sincronizar kits da Edeltec.
 * §16: Queries só em hooks. RB-04.
 * Suporta modos: incremental e full_replace.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SyncParams {
  tenant_id: string;
  api_config_id: string;
  fornecedor_id?: string | null;
  q?: string;
  max_pages?: number;
  only_generators?: boolean;
  mode?: "incremental" | "full_replace";
}

interface SyncResult {
  success: boolean;
  is_complete: boolean;
  total_fetched: number;
  created: number;
  updated: number;
  skipped: number;
  current_page: number;
  total_pages: number;
  synced_at: string;
}

export function useEdeltecSync() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncParams): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke("edeltec-sync", {
        body: { mode: "incremental", ...params },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na sincronização");

      // Auto-continuar batches até completar
      let result = data as SyncResult;
      let maxRetries = 50;
      while (result.success && !result.is_complete && maxRetries > 0) {
        maxRetries--;
        const { data: contData, error: contErr } = await supabase.functions.invoke("edeltec-sync", {
          body: { mode: "incremental", ...params },
        });
        if (contErr) break;
        if (!contData?.success) break;
        result = contData as SyncResult;
      }

      return result;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["solar-kit-catalog"] });
      qc.invalidateQueries({ queryKey: ["kits"] });
      qc.invalidateQueries({ queryKey: ["edeltec-catalog"] });
      qc.invalidateQueries({ queryKey: ["edeltec-sync-status"] });
      qc.invalidateQueries({ queryKey: ["edeltec-sync-logs"] });

      if (result.is_complete) {
        toast({
          title: "Sincronização concluída!",
          description: `${result.created} criados · ${result.updated} atualizados · ${result.skipped} ignorados`,
        });
      } else {
        toast({
          title: "Batch processado",
          description: `Página ${result.current_page}/${result.total_pages} · ${result.created} criados · ${result.updated} atualizados`,
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Erro na sincronização",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}
