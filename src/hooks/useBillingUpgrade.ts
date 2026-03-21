/**
 * useBillingUpgrade — Create Asaas charge for plan upgrade.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STALE_TIME = 1000 * 60 * 5;

export interface BillingCharge {
  id: string;
  tenant_id: string;
  asaas_charge_id: string | null;
  plan_id: string;
  valor: number;
  status: string;
  due_date: string;
  invoice_url: string | null;
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
}

export function useBillingCharges(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["billing_charges", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_charges")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as BillingCharge[];
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

export function useCreateUpgradeCharge() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "billing-create-charge",
        { body: { plan_id: planId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        success: boolean;
        charge_id: string;
        invoice_url: string | null;
        payment_link: string | null;
        already_exists?: boolean;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["billing_charges"] });
      if (data.already_exists) {
        toast.info("Cobrança já existente. Redirecionando...");
      } else {
        toast.success("Cobrança criada com sucesso!");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar cobrança");
    },
  });
}
