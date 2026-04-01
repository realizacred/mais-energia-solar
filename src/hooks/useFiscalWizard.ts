/**
 * Hook para dados de FiscalWizard.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_CONFIG = 1000 * 60 * 15;
const STALE_LIST = 1000 * 60 * 5;

// ─── Fiscal Settings ──────────────────────────
export function useFiscalWizardSettings() {
  return useQuery({
    queryKey: ["fiscal-wizard-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_settings")
        .select(
          "id, cnpj_emitente, inscricao_municipal, municipio_emitente, uf_emitente, regime_tributario, portal_nacional_enabled, allow_deductions, auto_issue_on_payment, default_service_description, default_observations, default_taxes, homologation_tested, is_active"
        )
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: STALE_CONFIG,
  });
}

// ─── Fiscal Municipal Services ──────────────────────────
export function useFiscalWizardServices() {
  return useQuery({
    queryKey: ["fiscal-wizard-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_municipal_services")
        .select("id, service_code, service_name, is_manual, is_active, synced_at")
        .eq("is_active", true)
        .order("service_name");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_LIST,
  });
}

// ─── Save Settings Mutation ──────────────────────────
export function useSaveFiscalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settingsId,
      payload,
    }: {
      settingsId: string | null;
      payload: Record<string, unknown>;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      if (settingsId) {
        const { error } = await supabase
          .from("fiscal_settings")
          .update(payload)
          .eq("id", settingsId);
        if (error) throw error;
        return { id: settingsId };
      } else {
        const { data, error } = await supabase
          .from("fiscal_settings")
          .insert({ ...payload, tenant_id: profile.tenant_id } as any)
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-wizard-settings"] });
    },
  });
}
