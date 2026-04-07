/**
 * useContacts — Query para listar contatos do WhatsApp.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  name: string | null;
  phone_e164: string;
  tags: string[];
  source: string | null;
  linked_cliente_id: string | null;
  last_interaction_at: string | null;
  created_at: string;
}

export function useContactsList() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone_e164, tags, source, linked_cliente_id, last_interaction_at, created_at")
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Contact[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
