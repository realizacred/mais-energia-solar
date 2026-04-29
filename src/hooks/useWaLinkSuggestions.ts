import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SuggestionRow } from "@/services/whatsapp/waLinkSuggestion";

export interface SuggestionWithEntity extends SuggestionRow {
  entity_name: string | null;
}

/**
 * Carrega sugestões pendentes de vínculo para um conjunto de conversas.
 * Faz hidratação leve do nome da entidade sugerida.
 */
export function useWaLinkSuggestions(conversationIds: string[]) {
  return useQuery<Record<string, SuggestionWithEntity>>({
    queryKey: ["wa-link-suggestions", conversationIds.join(",")],
    enabled: conversationIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_conversation_resolution_suggestions")
        .select("id, conversation_id, suggested_entity_type, suggested_entity_id, confidence, reason, evidence, status")
        .in("conversation_id", conversationIds)
        .eq("status", "pending");
      if (error) throw error;

      const rows = (data ?? []) as SuggestionRow[];

      // Hidratar nome (paralelo cliente/lead)
      const clienteIds = rows.filter((r) => r.suggested_entity_type === "cliente" && r.suggested_entity_id).map((r) => r.suggested_entity_id!);
      const leadIds = rows.filter((r) => r.suggested_entity_type === "lead" && r.suggested_entity_id).map((r) => r.suggested_entity_id!);

      const [{ data: clientes }, { data: leads }] = await Promise.all([
        clienteIds.length
          ? supabase.from("clientes").select("id, nome").in("id", clienteIds)
          : Promise.resolve({ data: [] as any[] }),
        leadIds.length
          ? supabase.from("leads").select("id, nome").in("id", leadIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const nameMap = new Map<string, string>();
      (clientes ?? []).forEach((c: any) => nameMap.set(`cliente:${c.id}`, c.nome));
      (leads ?? []).forEach((l: any) => nameMap.set(`lead:${l.id}`, l.nome));

      const out: Record<string, SuggestionWithEntity> = {};
      for (const r of rows) {
        out[r.conversation_id] = {
          ...r,
          entity_name: r.suggested_entity_type && r.suggested_entity_id
            ? nameMap.get(`${r.suggested_entity_type}:${r.suggested_entity_id}`) ?? null
            : null,
        };
      }
      return out;
    },
  });
}
