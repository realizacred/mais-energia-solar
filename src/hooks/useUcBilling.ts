/**
 * useUcBilling — Hooks for UC billing/cobrança queries.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface UcBillingRow {
  id: string;
  nome: string;
  codigo_uc: string;
  cliente_id: string | null;
  plano_servico_id: string | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  servico_cobranca_ativo: boolean;
}

/** Fetch UCs with billing columns */
export function useUcBillingList() {
  return useQuery({
    queryKey: ["uc_billing_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, cliente_id, plano_servico_id, valor_mensalidade, dia_vencimento, servico_cobranca_ativo" as any)
        .eq("is_archived", false)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as UcBillingRow[];
    },
    staleTime: STALE_TIME,
  });
}

/** Update billing config for a single UC */
export function useUpdateUcBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; plano_servico_id?: string | null; valor_mensalidade?: number | null; dia_vencimento?: number | null; servico_cobranca_ativo?: boolean }) => {
      const { error } = await supabase
        .from("units_consumidoras")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uc_billing_list"] });
      qc.invalidateQueries({ queryKey: ["ucs_list"] });
    },
  });
}

/** Billing KPIs */
export function useUcBillingKpis() {
  return useQuery({
    queryKey: ["uc_billing_kpis"],
    queryFn: async () => {
      const { data: ucs, error } = await supabase
        .from("units_consumidoras")
        .select("servico_cobranca_ativo, valor_mensalidade, plano_servico_id" as any)
        .eq("is_archived", false);
      if (error) throw error;

      const rows = (ucs || []) as unknown as { servico_cobranca_ativo: boolean; valor_mensalidade: number | null; plano_servico_id: string | null }[];
      const ativos = rows.filter(r => r.servico_cobranca_ativo);
      const semPlano = rows.filter(r => !r.plano_servico_id);
      const receitaMensal = ativos.reduce((s, r) => s + (r.valor_mensalidade || 0), 0);

      return {
        receitaMensal,
        ucsAtivas: ativos.length,
        ucsSemPlano: semPlano.length,
        totalUcs: rows.length,
      };
    },
    staleTime: STALE_TIME,
  });
}

/** Cobranças (recebimentos) linked to a specific UC */
export interface UcCobrancaRow {
  id: string;
  valor_total: number;
  descricao: string | null;
  status: string;
  data_acordo: string;
  created_at: string;
  parcelas: { id: string; valor: number; data_vencimento: string; status: string }[];
}

export function useUcCobrancas(unitId: string | null) {
  return useQuery({
    queryKey: ["uc_cobrancas", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("recebimentos")
        .select(`
          id, valor_total, descricao, status, data_acordo, created_at,
          parcelas(id, valor, data_vencimento, status)
        ` as any)
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as unknown as UcCobrancaRow[];
    },
    staleTime: STALE_TIME,
    enabled: !!unitId,
  });
}

/** Create a manual charge for a UC */
export function useCreateUcCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      tenant_id: string;
      cliente_id: string | null;
      unit_id: string;
      valor: number;
      descricao: string;
      dia_vencimento: number;
    }) => {
      const now = new Date();
      const dueDate = new Date(now.getFullYear(), now.getMonth(), payload.dia_vencimento);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);

      // Create recebimento
      const { data: rec, error: recErr } = await supabase
        .from("recebimentos")
        .insert({
          tenant_id: payload.tenant_id,
          cliente_id: payload.cliente_id,
          unit_id: payload.unit_id,
          valor_total: payload.valor,
          numero_parcelas: 1,
          forma_pagamento_acordada: "boleto",
          data_acordo: now.toISOString(),
          status: "pendente",
          descricao: payload.descricao,
        } as any)
        .select("id")
        .single();
      if (recErr) throw recErr;

      // Create parcela
      const { error: parErr } = await supabase
        .from("parcelas")
        .insert({
          recebimento_id: (rec as any).id,
          tenant_id: payload.tenant_id,
          numero_parcela: 1,
          valor: payload.valor,
          data_vencimento: dueDate.toISOString().split("T")[0],
          status: "pendente",
        } as any);
      if (parErr) throw parErr;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["uc_cobrancas", vars.unit_id] });
    },
  });
}