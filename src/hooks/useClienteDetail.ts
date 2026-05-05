import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface ClienteProjeto {
  id: string;
  codigo: string;
  status: string;
  created_at: string;
  potencia_kwp: number | null;
  valor_total: number | null;
  deal_id: string | null;
  numero_modulos: number | null;
  modelo_inversor: string | null;
}

export interface ClientePropostaNativa {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  codigo: string;
  versao_atual: number | null;
  lead_id: string | null;
}

export interface ClientePropostaVersao {
  id: string;
  status: string;
  valor_total: number | null;
  potencia_kwp: number | null;
  created_at: string;
  versao_numero: number | null;
  proposta_id: string;
}

export interface ClienteConversaWa {
  id: string;
  cliente_nome: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  last_message_preview: string | null;
}

/**
 * Projetos vinculados ao cliente
 */
export function useClienteProjetos(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente-projetos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, status, created_at, potencia_kwp, valor_total, deal_id")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClienteProjeto[];
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/**
 * Propostas nativas vinculadas ao cliente (via cliente_id ou lead_id)
 */
export function useClientePropostas(clienteId: string | null, leadId: string | null) {
  return useQuery({
    queryKey: ["cliente-propostas", clienteId, leadId],
    queryFn: async () => {
      // Try both cliente_id and lead_id
      const filters: string[] = [];
      if (clienteId) filters.push(`cliente_id.eq.${clienteId}`);
      if (leadId) filters.push(`lead_id.eq.${leadId}`);
      if (filters.length === 0) return [];

      const { data, error } = await supabase
        .from("propostas_nativas")
        .select("id, titulo, status, created_at, codigo, versao_atual, lead_id")
        .or(filters.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientePropostaNativa[];
    },
    staleTime: STALE_TIME,
    enabled: !!(clienteId || leadId),
  });
}

/**
 * Versões de propostas por proposta_ids
 */
export function useClientePropostaVersoes(propostaIds: string[]) {
  return useQuery({
    queryKey: ["cliente-proposta-versoes", propostaIds],
    queryFn: async () => {
      if (propostaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("id, status, valor_total, potencia_kwp, created_at, versao_numero, proposta_id")
        .in("proposta_id", propostaIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClientePropostaVersao[];
    },
    staleTime: STALE_TIME,
    enabled: propostaIds.length > 0,
  });
}

/**
 * Conversas WhatsApp vinculadas ao telefone do cliente
 */
export function useClienteConversasWa(telefone: string | null) {
  return useQuery({
    queryKey: ["cliente-wa-conversas", telefone],
    queryFn: async () => {
      if (!telefone) return [];
      const normalized = telefone.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, last_message_at, unread_count, status, last_message_preview")
        .or(`cliente_telefone.ilike.%${normalized}%,telefone_normalized.ilike.%${normalized}%`)
        .order("last_message_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as ClienteConversaWa[];
    },
    staleTime: STALE_TIME,
    enabled: !!telefone,
  });
}
