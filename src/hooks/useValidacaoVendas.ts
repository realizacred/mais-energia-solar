// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface Vendedor {
  id: string;
  nome: string;
  percentual_comissao: number | null;
}

export interface LeadSimulacao {
  id: string;
  investimento_estimado: number | null;
  potencia_recomendada_kwp: number | null;
  economia_mensal: number | null;
  consumo_kwh: number | null;
  geracao_mensal_estimada: number | null;
  payback_meses: number | null;
  created_at: string;
}

export function useVendedoresAtivos() {
  return useQuery({
    queryKey: ["vendedores-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, percentual_comissao")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Vendedor[];
    },
    staleTime: STALE_TIME,
  });
}

export function useLeadSimulacoes(leadId: string | null) {
  return useQuery({
    queryKey: ["lead-simulacoes-validacao", leadId],
    queryFn: async () => {
      if (!leadId) return [];

      const [{ data: legacySims }, { data: propostasNativas }] = await Promise.all([
        supabase
          .from("simulacoes")
          .select("id, investimento_estimado, potencia_recomendada_kwp, economia_mensal, consumo_kwh, geracao_mensal_estimada, payback_meses, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false }),
        supabase
          .from("propostas_nativas")
          .select("id")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const simsLegacy = (legacySims as LeadSimulacao[]) || [];
      let simsFromVersoes: LeadSimulacao[] = [];

      const propostaIds = (propostasNativas || []).map((p) => p.id);
      if (propostaIds.length > 0) {
        const { data: versoes } = await supabase
          .from("proposta_versoes")
          .select("id, valor_total, potencia_kwp, economia_mensal, consumo_mensal, geracao_mensal, payback_meses, created_at")
          .in("proposta_id", propostaIds)
          .order("created_at", { ascending: false });

        simsFromVersoes = (versoes || []).map((v) => ({
          id: v.id,
          investimento_estimado: v.valor_total,
          potencia_recomendada_kwp: v.potencia_kwp,
          economia_mensal: v.economia_mensal,
          consumo_kwh: v.consumo_mensal,
          geracao_mensal_estimada: v.geracao_mensal,
          payback_meses: v.payback_meses,
          created_at: v.created_at,
        }));
      }

      return [...simsLegacy, ...simsFromVersoes.filter((s) => !simsLegacy.some((l) => l.id === s.id))];
    },
    staleTime: STALE_TIME,
    enabled: !!leadId,
  });
}

export function useApproveVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      clienteId: string;
      leadId: string | null;
      valorTotal: number;
      statusConvertidoId: string;
      observacoes: string | null;
      itens: any[];
    }) => {
      const { data: vendaId, error } = await (supabase as any).rpc("approve_venda_with_composition", {
        p_cliente_id: params.clienteId,
        p_lead_id: params.leadId,
        p_valor_total: params.valorTotal,
        p_status_convertido_id: params.statusConvertidoId,
        p_observacoes: params.observacoes,
        p_itens: params.itens,
      });
      if (error) throw new Error(error.message);
      return vendaId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-validations"] });
    },
  });
}

export function useRejectVenda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      clienteId: string;
      leadId: string | null;
      reopenStatusId: string | null;
      motivoRejeicao: string;
    }) => {
      // Reopen lead if applicable
      if (params.reopenStatusId && params.leadId) {
        await supabase.from("leads").update({
          status_id: params.reopenStatusId,
          observacoes: `Rejeição de validação: ${params.motivoRejeicao}`,
        }).eq("id", params.leadId);
        await supabase.from("orcamentos").update({ status_id: params.reopenStatusId }).eq("lead_id", params.leadId);
      }

      // Check dependencies
      const depChecks = await Promise.all([
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", params.clienteId).neq("status", "excluida"),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("cliente_id", params.clienteId),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("customer_id", params.clienteId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("cliente_id", params.clienteId),
        supabase.from("obras").select("id", { count: "exact", head: true }).eq("cliente_id", params.clienteId),
        supabase.from("wa_conversations").select("id", { count: "exact", head: true }).eq("cliente_id", params.clienteId),
      ]);
      const depNames = ["Propostas", "Projetos", "Negociações", "Agendamentos", "Obras", "Conversas WhatsApp"];
      const blocking: string[] = [];
      depChecks.forEach((res, i) => {
        if ((res.count ?? 0) > 0) blocking.push(`${depNames[i]} (${res.count})`);
      });

      if (blocking.length > 0) {
        await supabase.from("clientes").update({ ativo: false }).eq("id", params.clienteId);
        return { deactivated: true, blocking };
      } else {
        await supabase.from("clientes").delete().eq("id", params.clienteId);
        return { deactivated: false, blocking: [] };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-validations"] });
    },
  });
}

export function useConvertidoStatus() {
  return useQuery({
    queryKey: ["lead-status-convertido"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Convertido")
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15, // config estática
  });
}
