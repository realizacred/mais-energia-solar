import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DinamicVariable {
  key: string;
  label: string;
  legacyKey: string;
  canonicalKey: string;
  categoria: 'projeto' | 'pre_dimensionamento' | 'pos_dimensionamento';
  governance: 'bd_cliente';
  tipoResultado: 'number' | 'text';
}

export function useVariaveisDinamicas() {
  return useQuery({
    queryKey: ["variables-catalog", "dynamic-fields"],
    queryFn: async (): Promise<DinamicVariable[]> => {
      const { data, error } = await supabase
        .from("deal_custom_fields")
        .select("field_key, title, field_context, field_type")
        .eq("is_active", true);

      if (error) throw error;

      return (data || []).map((field) => ({
        key: field.field_key,
        label: field.title,
        legacyKey: `[${field.field_key}]`,
        canonicalKey: `{{campo_custom.${field.field_key}}}`,
        categoria: field.field_context === 'pos_dimensionamento'
          ? 'pos_dimensionamento'
          : field.field_context === 'pre_dimensionamento'
          ? 'pre_dimensionamento'
          : 'projeto',
        governance: 'bd_cliente',
        tipoResultado: field.field_type === 'file' ? 'text'
          : field.field_type === 'number' ? 'number' : 'text'
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
