/**
 * usePropostas.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Read model via RPC proposal_list (single query, server-side joins).
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "propostas-listagem" as const;
const PAGE_SIZE = 50;

export interface PropostaFilters {
  status?: string;
  consultorId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface Proposta {
  id: string;
  nome: string;
  status: string;
  cliente_nome: string | null;
  cliente_celular: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_email: string | null;
  potencia_kwp: number | null;
  numero_modulos: number | null;
  modelo_modulo: string | null;
  modelo_inversor: string | null;
  preco_total: number | null;
  economia_mensal: number | null;
  geracao_mensal_kwh: number | null;
  payback_anos: number | null;
  distribuidora: string | null;
  link_pdf: string | null;
  expiration_date: string | null;
  generated_at: string | null;
  created_at: string;
  vendedor_id: string | null;
  vendedor?: { nome: string } | null;
}

export interface PropostaFormData {
  nome: string;
  cliente_nome: string;
  cliente_celular: string;
  cliente_cidade: string;
  cliente_estado: string;
  cliente_email: string;
  potencia_kwp: number;
  numero_modulos: number;
  modelo_modulo: string;
  modelo_inversor: string;
  preco_total: number;
  economia_mensal: number;
  geracao_mensal_kwh: number;
  payback_anos: number;
  distribuidora: string;
  vendedor_id: string;
}

/**
 * Fetch via RPC proposal_list — single server-side query.
 * No manual joins, no snapshot fallback, no N+1.
 */
export interface PropostaListResult {
  propostas: Proposta[];
  total: number;
}

async function fetchPropostas(filters: PropostaFilters = {}): Promise<PropostaListResult> {
  const params: Record<string, any> = {
    p_limit: filters.limit || PAGE_SIZE,
    p_offset: filters.offset || 0,
  };
  if (filters.status) params.p_status = filters.status;
  if (filters.consultorId) params.p_consultor_id = filters.consultorId;
  if (filters.search) params.p_search = filters.search;
  if (filters.dateFrom) params.p_date_from = filters.dateFrom;
  if (filters.dateTo) params.p_date_to = filters.dateTo;

  const { data, error } = await supabase.rpc("proposal_list" as any, params);
  if (error) throw error;

  const result = data as any;
  const rows = result?.data || [];
  const total = result?.total || 0;

  return {
    total,
    propostas: rows.map((r: any): Proposta => ({
      id: r.id,
      nome: r.nome || "Proposta",
      status: r.status,
      cliente_nome: r.cliente_nome || null,
      cliente_celular: r.cliente_celular || null,
      cliente_cidade: r.cliente_cidade || null,
      cliente_estado: r.cliente_estado || null,
      cliente_email: r.cliente_email || null,
      potencia_kwp: r.potencia_kwp != null ? Number(r.potencia_kwp) : null,
      numero_modulos: null,
      modelo_modulo: null,
      modelo_inversor: null,
      preco_total: r.preco_total != null ? Number(r.preco_total) : null,
      economia_mensal: r.economia_mensal != null ? Number(r.economia_mensal) : null,
      geracao_mensal_kwh: r.geracao_mensal_kwh != null ? Number(r.geracao_mensal_kwh) : null,
      payback_anos: r.payback_anos != null ? Number(r.payback_anos) : null,
      distribuidora: null,
      link_pdf: r.link_pdf || null,
      expiration_date: null,
      generated_at: r.generated_at || null,
      created_at: r.created_at,
      vendedor_id: r.vendedor_id || null,
      vendedor: r.consultor_nome ? { nome: r.consultor_nome } : null,
    })),
  };
}

/**
 * Hook para listar propostas via RPC proposal_list.
 * Suporta filtros e paginação server-side.
 */
export function usePropostas(filters: PropostaFilters = {}) {
  const queryClient = useQueryClient();
  const filtersKey = JSON.stringify(filters);

  const { data, isLoading: loading } = useQuery({
    queryKey: [QUERY_KEY, filtersKey],
    queryFn: () => fetchPropostas(filters),
    staleTime: STALE_TIME,
  });

  const propostas = data?.propostas ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: async (data: PropostaFormData) => {
      const snapshot = {
        clienteNome: data.cliente_nome,
        clienteCelular: data.cliente_celular,
        clienteEmail: data.cliente_email,
        locCidade: data.cliente_cidade,
        locEstado: data.cliente_estado,
        moduloModelo: data.modelo_modulo,
        inversorModelo: data.modelo_inversor,
        moduloQtd: data.numero_modulos,
        distribuidora: data.distribuidora,
      };

      const { data: result, error } = await supabase.rpc("proposal_create" as any, {
        p_titulo: data.nome || null,
        p_consultor_id: data.vendedor_id || null,
        p_snapshot: snapshot,
        p_potencia_kwp: data.potencia_kwp || null,
        p_valor_total: data.preco_total || null,
        p_economia_mensal: data.economia_mensal || null,
        p_geracao_mensal: data.geracao_mensal_kwh || null,
        p_payback_meses: data.payback_anos ? Math.round(data.payback_anos * 12) : null,
        p_intent: "wizard_save",
      });

      if (error) throw error;
      if ((result as any)?.error) throw new Error((result as any).error);

      return { id: (result as any).proposta_id };
    },
    onSuccess: () => {
      toast({ title: "Proposta criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar proposta", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: propostaInfo } = await supabase
        .from("propostas_nativas")
        .select("deal_id, projeto_id")
        .eq("id", id)
        .single();

      const { data, error } = await supabase.rpc("proposal_delete" as any, {
        p_proposta_id: id,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const dealId = propostaInfo?.deal_id || propostaInfo?.projeto_id;
      if (!dealId) return;

      const { data: remaining } = await supabase
        .from("propostas_nativas")
        .select("id")
        .or(`deal_id.eq.${dealId},projeto_id.eq.${dealId}`)
        .neq("status", "excluida")
        .neq("id", id)
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await supabase
          .from("deals")
          .update({ value: 0, kwp: 0 } as any)
          .eq("id", dealId);
        return;
      }

      const { data: latestVersion } = await supabase
        .from("proposta_versoes")
        .select("valor_total, potencia_kwp")
        .eq("proposta_id", remaining[0].id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .single();

      await supabase
        .from("deals")
        .update({
          value: latestVersion?.valor_total || 0,
          kwp: latestVersion?.potencia_kwp || 0,
        } as any)
        .eq("id", dealId);
    },
    onSuccess: () => {
      toast({ title: "Proposta excluída" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["deal-pipeline"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc("proposal_update_status" as any, {
        p_proposta_id: id,
        p_new_status: status,
        p_motivo: motivo || null,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (result: any) => {
      toast({ title: `Status atualizado para "${result.new_status}"` });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    },
  });

  const createProposta = useCallback(
    async (data: PropostaFormData) => {
      try {
        await createMutation.mutateAsync(data);
        return true;
      } catch {
        return false;
      }
    },
    [createMutation]
  );

  const deleteProposta = useCallback(
    (id: string) => deleteMutation.mutate(id),
    [deleteMutation]
  );

  const updateStatus = useCallback(
    (id: string, status: string, motivo?: string) => updateStatusMutation.mutate({ id, status, motivo }),
    [updateStatusMutation]
  );

  return {
    propostas,
    total,
    loading,
    creating: createMutation.isPending,
    fetchPropostas: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    createProposta,
    deleteProposta,
    updateStatus,
  };
}
