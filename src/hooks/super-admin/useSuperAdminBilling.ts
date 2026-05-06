/**
 * useSuperAdminBilling — Hooks for PR-2 Billing module.
 * SSOT: subscriptions table via super_admin_change_subscription RPC.
 * §16: queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callSuperAdminAction } from "@/lib/superAdminApi";
import { toast } from "sonner";

const STALE = 1000 * 60;

export interface TenantBillingData {
  subscription: {
    id: string; tenant_id: string; status: string;
    trial_ends_at: string | null;
    current_period_start: string; current_period_end: string;
    cancel_at_period_end: boolean; canceled_at: string | null;
    external_id: string | null;
    plan_id: string; plan_code: string; plan_name: string; price_monthly: number;
    created_at: string; updated_at: string;
  } | null;
  charges: Array<{
    id: string; asaas_charge_id: string | null; plan_id: string;
    valor: number; status: string; due_date: string;
    invoice_url: string | null; payment_link: string | null;
    paid_at: string | null; created_at: string;
  }>;
  webhook_events: Array<{
    id: string; provider: string; provider_event_id: string | null;
    received_at: string; processed_at: string | null;
    status: string; error_message: string | null; event_type: string | null;
  }>;
  dunning: Array<{
    id: string; subscription_id: string | null; charge_id: string | null;
    attempt_number: number; channel: string; status: string;
    error_message: string | null; attempted_at: string | null; created_at: string;
  }>;
  audit: Array<{
    id: string; action: string; details: any; created_at: string;
  }>;
}

export function useTenantBilling(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["super-admin-tenant-billing", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_get_tenant_billing", { _tenant_id: tenantId! });
      if (error) throw error;
      return data as unknown as TenantBillingData;
    },
    enabled: !!tenantId,
    staleTime: STALE,
  });
}

export function useGlobalSubscriptions(filterStatus?: string) {
  return useQuery({
    queryKey: ["super-admin-subs", filterStatus ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_list_subscriptions", {
        _status: filterStatus ?? null, _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as Array<any>;
    },
    staleTime: STALE,
  });
}

export function useGlobalWebhookEvents(provider?: string, status?: string) {
  return useQuery({
    queryKey: ["super-admin-webhooks", provider ?? "all", status ?? "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_list_webhook_events", {
        _provider: provider ?? null, _status: status ?? null, _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as Array<any>;
    },
    staleTime: STALE,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, tenantId?: string) {
  qc.invalidateQueries({ queryKey: ["super-admin-tenant-billing", tenantId] });
  qc.invalidateQueries({ queryKey: ["super-admin-subs"] });
  qc.invalidateQueries({ queryKey: ["super-admin-webhooks"] });
  qc.invalidateQueries({ queryKey: ["tenant-subscription"] });
  qc.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
}

export function useBillingAction(action: string, successMsg: string, tenantId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (extra: Record<string, any> = {}) => {
      return await callSuperAdminAction({ action, tenant_id: tenantId, ...extra });
    },
    onSuccess: () => { toast.success(successMsg); invalidate(qc, tenantId); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

