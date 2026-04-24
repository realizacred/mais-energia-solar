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
          cancelled_runs?: number;
          background_migration_paused?: boolean;
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
      qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      qc.invalidateQueries({ queryKey: ["canonical-check"] });
      qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
      // Limpa o card "Última migração interrompida" / "Última execução"
      qc.invalidateQueries({ queryKey: ["sm-migrate-chunk", "progress-v2"] });
      // Also refresh native project views
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });

      const c = data?.counts ?? {};
      const parts = [
        c.clientes && `${c.clientes} clientes`,
        c.projetos && `${c.projetos} projetos`,
        c.propostas_nativas && `${c.propostas_nativas} propostas`,
        c.proposta_versoes && `${c.proposta_versoes} versões`,
        c.deals && `${c.deals} deals`,
        c.recebimentos && `${c.recebimentos} recebimentos`,
      ].filter(Boolean);

      const pausedSuffix = data?.background_migration_paused
        ? ` Migração automática pausada${data?.cancelled_runs ? ` (${data.cancelled_runs} execução(ões) cancelada(s))` : ""}.`
        : "";

      toast.success("✅ Dados migrados limpos!", {
        description: parts.length > 0
          ? parts.join(", ") + " removidos. Dados SM preservados." + pausedSuffix
          : "Dados canônicos removidos. Dados SM preservados." + pausedSuffix,
        duration: 8000,
      });
      // RB-03-exception: no reload — user needs to see results on screen
    },
    onError: (err: Error) => {
      toast.error("Erro ao limpar migrados", { description: err.message });
    },
  });
}
