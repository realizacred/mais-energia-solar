import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

export function useResetMigratedData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const data = await invokeEdgeFunction<{
          success: boolean;
          counts?: Record<string, number>;
          error?: string;
        }>("reset-migrated-data", {
          body: { confirm: "LIMPAR MIGRADOS" },
        });

        if (data?.error) {
          throw new Error(data.error);
        }

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

      const c = data?.counts ?? {};
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.propostas_nativas && `${c.propostas_nativas} propostas`,
        c.proposta_versoes && `${c.proposta_versoes} versões`,
        c.deals && `${c.deals} deals`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
      ].filter(Boolean);

      toast.success("✅ Dados migrados limpos!", {
        description: parts.length > 0
          ? parts.join(", ") + " removidos. Dados SM preservados."
          : "Dados canônicos removidos. Dados SM preservados.",
        duration: 8000,
      });
      // RB-03-exception: no reload — user needs to see results on screen
    },
    onError: (err: Error) => {
      toast.error("Erro ao limpar migrados", { description: err.message });
    },
  });
}
