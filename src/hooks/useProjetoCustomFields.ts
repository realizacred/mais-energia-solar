import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useProjetoCustomFieldValues(dealId: string, stageId: string) {
  const fieldsQuery = useQuery({
    queryKey: ["deal-custom-fields-important", dealId, stageId],
    queryFn: async () => {
      const { data: fields } = await supabase
        .from("deal_custom_fields")
        .select("id, title, field_key, field_type, options, important_stage_ids, icon")
        .eq("is_active", true)
        .eq("field_context", "projeto")
        .eq("important_on_funnel", true)
        .order("ordem");
      if (!fields || fields.length === 0) return { fields: [], values: {} };

      const filtered = fields.filter((f: any) => {
        const ids: string[] = f.important_stage_ids || [];
        if (ids.length === 0) return true;
        return ids.includes(stageId);
      });

      if (filtered.length === 0) return { fields: filtered, values: {} };

      const fieldIds = filtered.map((f: any) => f.id);
      const { data: values } = await supabase
        .from("deal_custom_field_values")
        .select("field_id, value_text, value_number, value_boolean, value_date")
        .eq("deal_id", dealId)
        .in("field_id", fieldIds);

      const map: Record<string, any> = {};
      (values || []).forEach((v: any) => { map[v.field_id] = v; });

      return { fields: filtered, values: map };
    },
    staleTime: STALE_TIME,
    enabled: !!dealId && !!stageId,
  });

  return fieldsQuery;
}
