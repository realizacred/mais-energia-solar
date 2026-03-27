/**
 * Hook para enriquecimento de equipamentos via IA.
 * Busca specs técnicas automaticamente para módulos, inversores e otimizadores.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useToast } from "@/hooks/use-toast";

type EquipmentType = "modulo" | "inversor" | "otimizador" | "bateria";

interface EnrichParams {
  equipment_type: EquipmentType;
  equipment_id: string;
  force_refresh?: boolean;
}

interface EnrichResult {
  success: boolean;
  fields_filled?: number;
  equipment?: string;
  skipped?: boolean;
  message?: string;
  error?: string;
  winner_model?: string;
  dual_ai_used?: boolean;
}

const QUERY_KEY_MAP: Record<EquipmentType, string[]> = {
  modulo: ["modulos-solares"],
  inversor: ["inversores-catalogo"],
  otimizador: ["otimizadores-catalogo"],
  bateria: ["baterias"],
};

/**
 * Enriquecer um único equipamento via IA.
 */
export function useEnrichEquipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<EnrichResult, Error, EnrichParams>({
    mutationFn: async (params) => {
      const { tenantId } = await getCurrentTenantId();

      const { data, error } = await supabase.functions.invoke("enrich-equipment", {
        body: { ...params, tenant_id: tenantId },
      });

      if (error) throw new Error(error.message || "Erro ao enriquecer equipamento");
      if (data?.error) throw new Error(data.error);
      return data as EnrichResult;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_MAP[vars.equipment_type] });

      const modelName = data.winner_model
        ? (data.winner_model.split("/").pop() || "IA")
        : "IA";

      if (data.skipped) {
        toast({ title: "Já enriquecido", description: data.message });
      } else {
        toast({
          title: "Specs encontradas",
          description: `${data.fields_filled} campos preenchidos para ${data.equipment} via ${modelName}${data.dual_ai_used ? " (Dual IA)" : ""}`,
        });
      }
    },
    onError: (err) => {
      toast({
        title: "Erro ao buscar specs",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}

interface BatchEnrichParams {
  equipment_type: EquipmentType;
  ids: string[];
  onProgress?: (processed: number, total: number) => void;
}

interface BatchResult {
  processed: number;
  success: number;
  failed: number;
  errors: string[];
}

/**
 * Enriquecer em lote equipamentos selecionados.
 */
export function useEnrichEquipmentBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<BatchResult, Error, BatchEnrichParams>({
    mutationFn: async ({ equipment_type, ids, onProgress }) => {
      const { tenantId } = await getCurrentTenantId();

      const result: BatchResult = { processed: 0, success: 0, failed: 0, errors: [] };

      for (let i = 0; i < ids.length; i++) {
        try {
          const { data, error } = await supabase.functions.invoke("enrich-equipment", {
            body: { equipment_type, equipment_id: ids[i], tenant_id: tenantId },
          });

          if (error || data?.error) {
            result.failed++;
            result.errors.push(`${ids[i]}: ${error?.message || data?.error}`);
          } else {
            result.success++;
          }
        } catch (e: any) {
          result.failed++;
          result.errors.push(`${ids[i]}: ${e.message}`);
        }

        result.processed++;
        onProgress?.(result.processed, ids.length);

        // Rate limiting: 1 chamada por segundo
        if (i < ids.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      return result;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_MAP[vars.equipment_type] });
      toast({
        title: "Enriquecimento em lote concluído",
        description: `${data.success} de ${data.processed} equipamentos enriquecidos. ${data.failed > 0 ? `${data.failed} falharam.` : ""}`,
      });
    },
    onError: (err) => {
      toast({
        title: "Erro no enriquecimento em lote",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}
