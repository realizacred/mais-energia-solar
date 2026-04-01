// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface RecebimentoRow {
  id: string;
  cliente_id: string;
  valor_total: number;
  forma_pagamento_acordada: string;
  numero_parcelas: number;
  descricao: string | null;
  data_acordo: string;
  status: string;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string; telefone: string } | null;
  parcelas?: {
    id: string;
    numero_parcela: number;
    valor: number;
    data_vencimento: string;
    status: string;
  }[];
}

export interface RecebimentoFilters {
  status?: string;
  cliente_id?: string;
}

export function useRecebimentos(filters?: RecebimentoFilters) {
  return useQuery({
    queryKey: ["recebimentos", filters],
    queryFn: async () => {
      let q = supabase
        .from("recebimentos")
        .select(`
          *,
          clientes(nome, telefone),
          parcelas(id, numero_parcela, valor, data_vencimento, status)
        `)
        .order("created_at", { ascending: false });

      if (filters?.status && filters.status !== "all")
        q = q.eq("status", filters.status);
      if (filters?.cliente_id && filters.cliente_id !== "all")
        q = q.eq("cliente_id", filters.cliente_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RecebimentoRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useRecebimentosFull() {
  return useQuery({
    queryKey: ["recebimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select(`
          *,
          clientes (id, nome, telefone),
          pagamentos (id, valor_pago, forma_pagamento, data_pagamento, observacoes)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useClientesAtivos() {
  return useQuery({
    queryKey: ["clientes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshRecebimentos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["recebimentos"] });
}
