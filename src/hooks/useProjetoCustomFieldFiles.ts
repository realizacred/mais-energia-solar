/**
 * Lê arquivos de TODOS os campos customizados tipo file de um deal.
 * Usa a tabela `deal_custom_field_values` + `deal_custom_fields` (label real).
 * Retorno achatado: 1 entrada por arquivo (mesmo campo pode ter vários).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseFileMetaArray, type CustomFieldFileMeta } from "@/components/admin/projetos/CustomFieldFileInput";

export interface CustomFieldFileEntry extends CustomFieldFileMeta {
  field_id: string;
  field_key: string;
  field_title: string;
}

export function useProjetoCustomFieldFiles(dealId: string) {
  return useQuery({
    queryKey: ["projeto-custom-field-files", dealId],
    queryFn: async (): Promise<CustomFieldFileEntry[]> => {
      const { data, error } = await supabase
        .from("deal_custom_field_values")
        .select("field_id, value_text, deal_custom_fields!inner(id, field_key, title, field_type)")
        .eq("deal_id", dealId);
      if (error) throw error;
      const out: CustomFieldFileEntry[] = [];
      for (const row of (data || []) as any[]) {
        const field = row.deal_custom_fields;
        if (!field || field.field_type !== "file") continue;
        const metas = parseFileMetaArray(row.value_text);
        for (const m of metas) {
          out.push({
            ...m,
            field_id: field.id,
            field_key: field.field_key,
            field_title: field.title,
          });
        }
      }
      // Mais recentes primeiro
      return out.sort((a, b) =>
        (b.uploaded_at || "").localeCompare(a.uploaded_at || "")
      );
    },
    staleTime: 1000 * 60,
    enabled: !!dealId,
  });
}
