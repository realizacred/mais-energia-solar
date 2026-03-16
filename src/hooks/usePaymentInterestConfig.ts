import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FormaPagamento, JurosTipo, JurosResponsavel } from "@/services/paymentComposition/types";

export interface PaymentInterestConfig {
  id: string;
  tenant_id: string;
  forma_pagamento: FormaPagamento;
  juros_tipo: JurosTipo;
  juros_valor: number;
  juros_responsavel: JurosResponsavel;
  parcelas_padrao: number;
  intervalo_dias_padrao: number;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["payment-interest-config"];

export function usePaymentInterestConfigs() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_interest_config")
        .select("*")
        .order("forma_pagamento");
      if (error) throw error;
      return (data ?? []) as PaymentInterestConfig[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Returns a map forma_pagamento → config for quick lookup */
export function usePaymentInterestConfigMap() {
  const query = usePaymentInterestConfigs();
  const map = new Map<FormaPagamento, PaymentInterestConfig>();
  if (query.data) {
    for (const c of query.data) {
      if (c.ativo) map.set(c.forma_pagamento, c);
    }
  }
  return { ...query, configMap: map };
}

export function useUpsertPaymentInterestConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Omit<PaymentInterestConfig, "id" | "tenant_id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("payment_interest_config")
        .upsert(config, { onConflict: "tenant_id,forma_pagamento" })
        .select()
        .single();
      if (error) throw error;
      return data as PaymentInterestConfig;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Configuração de juros salva");
    },
    onError: (err: any) => {
      console.error("[PaymentInterestConfig] upsert error:", err);
      toast.error("Erro ao salvar configuração de juros");
    },
  });
}

export function useDeletePaymentInterestConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("payment_interest_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Configuração removida");
    },
    onError: () => toast.error("Erro ao remover configuração"),
  });
}
