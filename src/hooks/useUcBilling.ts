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
