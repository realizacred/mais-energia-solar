/**
 * useEdeltecApiConfig — Query para config da API Edeltec por tenant.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EdeltecApiConfig {
  id: string;
  fornecedor_id: string | null;
}

export function useEdeltecApiConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["edeltec-api-config", tenantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("integrations_api_config")
        .select("id, fornecedor_id")
        .eq("tenant_id", tenantId)
        .eq("provider", "edeltec")
        .eq("ativo", true)
        .maybeSingle();
      return data as EdeltecApiConfig | null;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!tenantId,
  });
}
