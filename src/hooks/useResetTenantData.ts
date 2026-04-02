import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

export function useResetTenantData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const data = await invokeEdgeFunction<{
          success: boolean;
          tenantId?: string;
          counts?: Record<string, number>;
          results?: Record<string, number>;
          error?: string;
        }>("reset-tenant-data", {
          body: { confirm: "APAGAR TUDO" },
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
      qc.clear();
      const c = data?.counts ?? data?.results ?? {};
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.propostas_nativas && `${c.propostas_nativas} propostas`,
        c.proposta_versoes && `${c.proposta_versoes} versões`,
        c.deals && `${c.deals} deals`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
      ].filter(Boolean);

      toast.success("✅ Reset concluído!", {
        description: parts.length > 0
          ? parts.join(", ") + " apagados."
          : "Todos os dados foram apagados.",
        duration: 8000,
      });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (err: Error) => {
      toast.error("Erro ao resetar", { description: err.message });
    },
  });
}
