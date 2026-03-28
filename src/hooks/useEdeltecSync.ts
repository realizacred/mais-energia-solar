/**
 * useEdeltecSync — Mutation para sincronizar kits da Edeltec.
 * §16: Queries só em hooks. RB-04.
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
}

interface SyncResult {
  success: boolean;
  total_fetched: number;
  created: number;
  updated: number;
  skipped: number;
  synced_at: string;
}

export function useEdeltecSync() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: SyncParams): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke("edeltec-sync", {
        body: params,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na sincronização");
      return data as SyncResult;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["solar-kit-catalog"] });
      qc.invalidateQueries({ queryKey: ["kits"] });
      toast({
        title: "Sincronização concluída!",
        description: `${result.created} criados · ${result.updated} atualizados · ${result.skipped} ignorados`,
      });
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
