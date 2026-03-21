import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface ClienteProjeto {
  id: string;
  nome: string;
  status: string;
  created_at: string;
  potencia_kwp: number | null;
  valor_total: number | null;
}

export interface ClienteProposta {
  id: string;
  titulo: string;
  status: string;
  valor_total: number | null;
  created_at: string;
  orcamento_id: string;
}

export interface ClienteConversaWa {
  id: string;
  contact_name: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
}

export function useClienteProjetos(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-projetos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, status, created_at, potencia_kwp, valor_total")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClienteProjeto[];
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

export function useClientePropostas(leadId: string | null) {
  return useQuery({
    queryKey: ["cliente-propostas", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("id, titulo, status, valor_total, created_at, orcamento_id")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClienteProposta[];
    },
    staleTime: STALE_TIME,
    enabled: !!leadId,
  });
}

export function useClienteConversasWa(telefone: string | null) {
  return useQuery({
    queryKey: ["cliente-wa-conversas", telefone],
    queryFn: async () => {
      if (!telefone) return [];
      // Normalize phone for matching
      const normalized = telefone.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("id, contact_name, last_message_at, unread_count, status")
        .or(`contact_phone.ilike.%${normalized}%,contact_phone.ilike.%${telefone}%`)
        .order("last_message_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as ClienteConversaWa[];
    },
    staleTime: STALE_TIME,
    enabled: !!telefone,
  });
}
