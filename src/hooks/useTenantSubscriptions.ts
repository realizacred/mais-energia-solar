/**
 * useTenantSubscriptions — Admin view of all tenant subscriptions.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "admin_tenant_subscriptions" as const;

export interface TenantSubscriptionAdmin {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  plans?: { code: string; name: string } | null;
  tenants?: { nome: string } | null;
}

export function useTenantSubscriptionsAdmin() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plans(code, name), tenants:tenant_id(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantSubscriptionAdmin[];
    },
    staleTime: STALE_TIME,
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; plan_id?: string }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      qc.invalidateQueries({ queryKey: ["tenant-subscription"] });
    },
  });
}
