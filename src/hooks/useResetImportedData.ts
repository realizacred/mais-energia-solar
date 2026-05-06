import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

export function useResetImportedData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        const data = await invokeEdgeFunction<{
          success: boolean;
          counts?: Record<string, number>;
          error?: string;
        }>("reset-imported-data", { body: { confirm: "LIMPAR IMPORTADOS" } });
        if (data?.error) throw new Error(data.error);
        return data;
      } catch (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message);
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sm-clients"] });
      qc.invalidateQueries({ queryKey: ["sm-projects"] });
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
      qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
      qc.invalidateQueries({ queryKey: ["sm-migrate-chunk", "progress-v2"] });
      const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
      toast.success("✅ Dados importados (staging) limpos!", {
        description: `${total} registros removidos. Canônicos preservados.`,
        duration: 8000,
      });
    },
    onError: (err: Error) =>
      toast.error("Erro ao limpar importados", { description: err.message }),
  });
}
