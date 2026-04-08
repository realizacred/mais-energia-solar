import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

export interface ProjectAreaCounts {
  clientes: number;
  projetos: number;
  deals: number;
  propostas: number;
  versoes: number;
  documentos: number;
  recebimentos: number;
  comissoes: number;
  checklists: number;
  appointments: number;
}

export function useResetProjectArea() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        const data = await invokeEdgeFunction<{
          success: boolean;
          counts?: ProjectAreaCounts;
          error?: string;
        }>("reset-project-area", {
          body: { confirm: "RESETAR AREA PROJETO" },
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
      const c = data?.counts ?? ({} as Partial<ProjectAreaCounts>);
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.deals && `${c.deals} deals`,
        c.propostas && `${c.propostas} propostas`,
        c.versoes && `${c.versoes} versões`,
        c.documentos && `${c.documentos} documentos`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
        c.comissoes && `${c.comissoes} comissões`,
      ].filter(Boolean);

      toast.success("✅ Área de projetos resetada!", {
        description: parts.length > 0
          ? parts.join(", ") + " removidos. Leads preservados."
          : "Todos os dados de projeto foram removidos. Leads preservados.",
        duration: 8000,
      });
      // RB-03-exception: no auto-reload — user needs to see results
    },
    onError: (err: Error) => {
      toast.error("Erro ao resetar área de projetos", { description: err.message });
    },
  });
}
