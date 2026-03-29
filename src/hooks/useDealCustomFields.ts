/**
 * Hook para buscar campos customizados (deal_custom_fields) ativos.
 * Usado para sincronizar campos dinâmicos com a página de variáveis.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealCustomField {
  id: string;
  title: string;
  field_key: string;
  field_type: string;
  field_context: string;
  options: any;
  is_active: boolean;
  ordem: number;
}

const QUERY_KEY = "deal-custom-fields-active" as const;
const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Fetches all active deal_custom_fields (projeto, pre_dimensionamento, pos_dimensionamento).
 */
export function useDealCustomFields() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_custom_fields")
        .select("id, title, field_key, field_type, field_context, options, is_active, ordem")
        .eq("is_active", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as DealCustomField[]) ?? [];
    },
    staleTime: STALE_TIME,
  });
}

/** Context labels for display */
export const FIELD_CONTEXT_LABELS: Record<string, string> = {
  projeto: "Projeto",
  pre_dimensionamento: "Pré-dimensionamento",
  pos_dimensionamento: "Pós-dimensionamento",
};

/** Context icons for display */
export const FIELD_CONTEXT_ICONS: Record<string, string> = {
  projeto: "📋",
  pre_dimensionamento: "📐",
  pos_dimensionamento: "✅",
};
