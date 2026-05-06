import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

export function useResetNativeData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        const data = await invokeEdgeFunction<{
          success: boolean;
          counts?: Record<string, number>;
          error?: string;
        }>("reset-native-data", { body: { confirm: "LIMPAR NATIVOS" } });
        if (data?.error) throw new Error(data.error);
        return data;
      } catch (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message);
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      const c = data?.counts ?? {};
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.propostas_nativas && `${c.propostas_nativas} propostas`,
        c.deals && `${c.deals} deals`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
      ].filter(Boolean);
      toast.success("✅ Dados nativos limpos!", {
        description: parts.length
          ? parts.join(", ") + " removidos. Migrados SM preservados."
          : "Nenhum registro nativo encontrado.",
        duration: 8000,
      });
    },
    onError: (err: Error) =>
      toast.error("Erro ao limpar nativos", { description: err.message }),
  });
}
