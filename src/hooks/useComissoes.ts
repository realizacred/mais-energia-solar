// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

export interface ComissaoRow {
  id: string;
  consultor_id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  descricao: string;
  valor_base: number;
  percentual_comissao: number;
  valor_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  consultores?: { nome: string };
  clientes?: { nome: string } | null;
  projetos?: { codigo: string } | null;
  pagamentos_comissao?: { valor_pago: number; data_pagamento: string }[];
}

export interface ComissaoFilters {
  consultor_id?: string;
  status?: string;
  cliente_id?: string;
  mes?: number;
  ano?: number;
}

export function useComissoes(filters?: ComissaoFilters) {
  return useQuery({
    queryKey: ["comissoes", filters],
    queryFn: async () => {
      let q = supabase
        .from("comissoes")
        .select(`
          *,
          consultores(nome),
          clientes(nome),
          projetos(codigo),
          pagamentos_comissao(valor_pago, data_pagamento)
        `)
        .order("created_at", { ascending: false });

      if (filters?.mes) q = q.eq("mes_referencia", filters.mes);
      if (filters?.ano) q = q.eq("ano_referencia", filters.ano);
      if (filters?.consultor_id && filters.consultor_id !== "all")
        q = q.eq("consultor_id", filters.consultor_id);
      if (filters?.status && filters.status !== "all")
        q = q.eq("status", filters.status);
      if (filters?.cliente_id && filters.cliente_id !== "all")
        q = q.eq("cliente_id", filters.cliente_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ComissaoRow[];
    },
    staleTime: STALE_TIME,
  });
}

/** All comissoes (for reports — no month/year filter) */
export function useAllComissoes() {
  return useQuery({
    queryKey: ["comissoes", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select(`
          *,
          consultores(nome),
          pagamentos_comissao(valor_pago, data_pagamento)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ComissaoRow[];
    },
    staleTime: STALE_TIME,
  });
}

/** Consultores ativos (para selects) */
export function useConsultoresAtivos() {
  return useQuery({
    queryKey: ["consultores", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: STALE_TIME,
  });
}

/** Clientes ativos (para selects) */
export function useClientesAtivos() {
  return useQuery({
    queryKey: ["clientes", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: STALE_TIME,
  });
}

/** Mutation para inserir comissão */
export interface SalvarComissaoPayload {
  consultor_id: string;
  descricao: string;
  valor_base: number;
  percentual_comissao: number;
  valor_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  observacoes: string | null;
}

export function useSalvarComissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SalvarComissaoPayload) => {
      const { error } = await supabase.from("comissoes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    },
  });
}

/** Mutation para deletar comissão */
export function useDeletarComissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comissoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comissoes"] });
    },
  });
}
