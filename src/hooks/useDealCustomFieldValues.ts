/**
 * Hook para buscar valores de campos customizados de um deal.
 * Retorna Record<field_key, valor> para merge com customFieldValues do wizard.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useDealCustomFieldValues(dealId: string | null | undefined) {
  return useQuery({
    queryKey: ["deal-custom-field-values", dealId],
    enabled: !!dealId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_custom_field_values")
        .select("field_id, value_text, value_number, value_boolean, value_date, deal_custom_fields!inner(field_key, field_type)")
        .eq("deal_id", dealId!);
      if (error) throw error;

      const result: Record<string, any> = {};
      for (const row of (data ?? [])) {
        const field = (row as any).deal_custom_fields;
        if (!field?.field_key) continue;
        const key = field.field_key as string;
        const type = field.field_type as string;

        if (type === "boolean") {
          result[key] = row.value_boolean;
        } else if (type === "number" || type === "currency") {
          result[key] = row.value_number;
        } else if (type === "date") {
          result[key] = row.value_date;
        } else {
          result[key] = row.value_text;
        }
      }
      return result;
    },
  });
}
