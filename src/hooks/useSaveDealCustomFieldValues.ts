/**
 * Hook para persistir valores de campos customizados em deal_custom_field_values.
 * Faz upsert com onConflict: deal_id,field_id.
 * §16: Queries/mutations só em hooks — NUNCA em componentes
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface SaveParams {
  dealId: string;
  /** Record<field_key, value> from wizard customFieldValues */
  values: Record<string, any>;
}

export function useSaveDealCustomFieldValues() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, values }: SaveParams) => {
      if (!dealId || !values || Object.keys(values).length === 0) return;

      // 0. Resolve tenant_id for RLS compliance
      const { tenantId } = await getCurrentTenantId();

      // 1. Fetch field definitions to map field_key → field_id + field_type
      const { data: fields, error: fieldsErr } = await supabase
        .from("deal_custom_fields")
        .select("id, field_key, field_type")
        .eq("is_active", true);

      if (fieldsErr) throw fieldsErr;
      if (!fields || fields.length === 0) return;

      const fieldMap = new Map(fields.map((f) => [f.field_key, f]));

      // 2. Build upsert rows
      const rows: Array<Record<string, any>> = [];
      for (const [key, val] of Object.entries(values)) {
        const field = fieldMap.get(key);
        if (!field) continue;
        if (val === undefined) continue;

        const row: Record<string, any> = {
          deal_id: dealId,
          field_id: field.id,
          tenant_id: tenantId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_date: null,
        };

        if (field.field_type === "boolean") {
          row.value_boolean = val ?? null;
        } else if (field.field_type === "number" || field.field_type === "currency") {
          row.value_number = val != null ? Number(val) : null;
        } else if (field.field_type === "date") {
          row.value_date = val || null;
        } else {
          // text, select, multi_select, multiselect, textarea
          row.value_text = Array.isArray(val) ? JSON.stringify(val) : (val != null ? String(val) : null);
        }

        rows.push(row);
      }

      if (rows.length === 0) return;

      // 3. Batch upsert
      const { error } = await supabase
        .from("deal_custom_field_values")
        .upsert(rows as any, { onConflict: "deal_id,field_id" });

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["deal-custom-field-values", variables.dealId] });
    },
  });
}
