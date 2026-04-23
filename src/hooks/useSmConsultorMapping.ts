/**
 * useSmConsultorMapping — gerencia o mapeamento etapa do SolarMarket → consultor do CRM.
 *
 * Governança:
 *  - RB-04: query em hook dedicado
 *  - RB-05: staleTime obrigatório
 *  - RB-58: mutation usa .select() para confirmar gravação
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface SmConsultorMappingRow {
  id: string;
  sm_name: string;
  consultor_id: string | null;
}

export function useSmConsultorMappings(tenantId: string | null | undefined) {
  return useQuery<SmConsultorMappingRow[]>({
    queryKey: ["sm-consultor-mappings", tenantId],
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sm_consultor_mapping")
        .select("id, sm_name, consultor_id")
        .eq("tenant_id", tenantId!);
      if (error) throw new Error(error.message);
      return (data ?? []) as SmConsultorMappingRow[];
    },
  });
}

interface SaveInput {
  tenantId: string;
  smEtapaName: string;
  consultorId: string;
}

export function useSaveConsultorMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, smEtapaName, consultorId }: SaveInput) => {
      const { data, error } = await supabase
        .from("sm_consultor_mapping")
        .upsert(
          {
            tenant_id: tenantId,
            sm_name: smEtapaName,
            consultor_id: consultorId,
          },
          { onConflict: "tenant_id,sm_name" },
        )
        .select("id");

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Falha ao salvar mapeamento (0 linhas afetadas).");
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sm-consultor-mappings", vars.tenantId] });
    },
  });
}
