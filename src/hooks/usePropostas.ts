/**
 * usePropostas.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * MIGRADO: propostas_sm_legado → propostas_nativas + proposta_versoes (SSOT)
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "propostas-listagem" as const;

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
 * Fetch propostas from propostas_nativas joined with latest proposta_versoes.
 * Maps native fields to the legacy Proposta interface for backward compatibility.
 */
async function fetchPropostas(): Promise<Proposta[]> {
  // 1) Get all propostas_nativas that aren't deleted
  const { data: nativas, error } = await (supabase as any)
    .from("propostas_nativas")
    .select(`
      id, codigo, titulo, status, deal_id, lead_id, cliente_id,
      consultor_id, created_at, updated_at,
      consultor_ref:consultores(nome)
    `)
    .neq("status", "excluida")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!nativas || nativas.length === 0) return [];

  // 2) Get latest version for each proposta
  const propostaIds = nativas.map((n: any) => n.id);
  const { data: versoes } = await (supabase as any)
    .from("proposta_versoes")
    .select(`
      id, proposta_id, potencia_kwp, valor_total, economia_mensal,
      geracao_mensal, payback_meses, snapshot, output_pdf_path,
      gerado_em, created_at, public_slug
    `)
    .in("proposta_id", propostaIds)
    .order("versao_numero", { ascending: false });

  // Build a map: proposta_id → latest version
  const latestVersionMap = new Map<string, any>();
  for (const v of (versoes || [])) {
    if (!latestVersionMap.has(v.proposta_id)) {
      latestVersionMap.set(v.proposta_id, v);
    }
  }

  // 3) Get client/lead names for display
  const clienteIds = [...new Set(nativas.filter((n: any) => n.cliente_id).map((n: any) => n.cliente_id))] as string[];
  const leadIds = [...new Set(nativas.filter((n: any) => n.lead_id && !n.cliente_id).map((n: any) => n.lead_id))] as string[];

  const [clientesRes, leadsRes] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from("clientes").select("id, nome, telefone, email, cidade, estado").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    leadIds.length > 0
      ? (supabase as any).from("leads").select("id, nome, telefone, email, cidade, estado").in("id", leadIds)
      : Promise.resolve({ data: [] }),
  ]);

  const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));
  const leadMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l]));

  // 4) Map to Proposta interface
  return nativas.map((n: any): Proposta => {
    const v = latestVersionMap.get(n.id);
    const snapshot = v?.snapshot || {};
    const cliente = n.cliente_id ? clienteMap.get(n.cliente_id) : null;
    const lead = !cliente && n.lead_id ? leadMap.get(n.lead_id) : null;
    const person = cliente || lead;

    return {
      id: n.id,
      nome: n.titulo || n.codigo || "Proposta",
      status: n.status,
      cliente_nome: person?.nome || snapshot.clienteNome || snapshot.cliente_nome || null,
      cliente_celular: person?.telefone || null,
      cliente_cidade: person?.cidade || snapshot.locCidade || snapshot.loc_cidade || null,
      cliente_estado: person?.estado || snapshot.locEstado || snapshot.loc_estado || null,
      cliente_email: person?.email || null,
      potencia_kwp: Number(v?.potencia_kwp) || null,
      numero_modulos: Number(snapshot.moduloQtd ?? snapshot.modulo_qtd) || null,
      modelo_modulo: snapshot.moduloModelo ?? snapshot.modulo_modelo ?? null,
      modelo_inversor: snapshot.inversorModelo ?? snapshot.inversor_modelo ?? null,
      preco_total: Number(v?.valor_total) || null,
      economia_mensal: Number(v?.economia_mensal) || null,
      geracao_mensal_kwh: Number(v?.geracao_mensal) || null,
      payback_anos: v?.payback_meses ? Number(v.payback_meses) / 12 : null,
      distribuidora: snapshot.locDistribuidoraNome ?? snapshot.distribuidora ?? null,
      link_pdf: v?.output_pdf_path || null,
      expiration_date: null,
      generated_at: v?.gerado_em || null,
      created_at: n.created_at,
      vendedor_id: n.consultor_id || null,
      vendedor: n.consultor_ref ? { nome: n.consultor_ref.nome } : null,
    };
  });
}

/**
 * Hook para listar propostas (agora baseado em propostas_nativas).
 */
export function usePropostas() {
  const queryClient = useQueryClient();

  const { data: propostas = [], isLoading: loading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: fetchPropostas,
    staleTime: STALE_TIME,
  });

  const createMutation = useMutation({
    mutationFn: async (data: PropostaFormData) => {
      // Create propostas_nativas record
      const { data: proposta, error: pErr } = await (supabase as any)
        .from("propostas_nativas")
        .insert({
          titulo: data.nome,
          status: "rascunho",
          consultor_id: data.vendedor_id || null,
        })
        .select("id")
        .single();

      if (pErr) throw pErr;

      // Create initial version via RPC (SSOT)
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

      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        "proposal_create_version" as any,
        {
          p_proposta_id: proposta.id,
          p_versao_id: null,
          p_snapshot: snapshot,
          p_potencia_kwp: data.potencia_kwp || null,
          p_valor_total: data.preco_total || null,
          p_economia_mensal: data.economia_mensal || null,
          p_geracao_mensal: data.geracao_mensal_kwh || null,
          p_payback_meses: data.payback_anos ? Math.round(data.payback_anos * 12) : null,
          p_intent: "wizard_save",
        },
      );

      if (rpcErr) throw rpcErr;
      if ((rpcResult as any)?.error) throw new Error((rpcResult as any).error);

      return proposta;
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
      // Soft delete via SECURITY DEFINER RPC
      const { data, error } = await supabase.rpc("proposal_delete" as any, {
        p_proposta_id: id,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast({ title: "Proposta excluída" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("propostas_nativas")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({ title: `Status atualizado para "${status}"` });
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
    (id: string, status: string) => updateStatusMutation.mutate({ id, status }),
    [updateStatusMutation]
  );

  return {
    propostas,
    loading,
    creating: createMutation.isPending,
    fetchPropostas: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    createProposta,
    deleteProposta,
    updateStatus,
  };
}
