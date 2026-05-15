import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

/**
 * Módulo de Regras de Negócio Financeiras (Configuráveis)
 * Centraliza a lógica de decisão baseada nas configurações do tenant.
 */

export type FinancialSettings = {
  receipt_auto_emit: boolean;
  receipt_allow_standalone: boolean;
  receipt_auto_numbering: boolean;
  receipt_show_qrcode: boolean;
  receipt_digital_signature: boolean;
  cash_strict_opening: boolean;
  cash_daily_closing: boolean;
  cash_multi_user: boolean;
  cash_lock_on_close: boolean;
  commission_trigger: 'proposal_accepted' | 'payment_cleared' | 'manual';
  audit_require_justification: boolean;
  audit_allow_hard_delete: boolean;
  audit_storno_approval_required: boolean;
  audit_lock_days: number;
  automation_whatsapp_enabled: boolean;
  automation_email_enabled: boolean;
  feature_flags: Record<string, boolean>;
};

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  receipt_auto_emit: true,
  receipt_allow_standalone: true,
  receipt_auto_numbering: true,
  receipt_show_qrcode: true,
  receipt_digital_signature: false,
  cash_strict_opening: false,
  cash_daily_closing: false,
  cash_multi_user: false,
  cash_lock_on_close: true,
  commission_trigger: 'payment_cleared',
  audit_require_justification: false,
  audit_allow_hard_delete: false,
  audit_storno_approval_required: false,
  audit_lock_days: 0,
  automation_whatsapp_enabled: false,
  automation_email_enabled: false,
  feature_flags: {},
};

/**
 * Hook para acessar as configurações financeiras do tenant atual.
 */
export function useFinancialSettings() {
  const { data: tenantId } = useTenantId();

  return useQuery({
    queryKey: ['financial-settings', tenantId],
    queryFn: async (): Promise<FinancialSettings> => {
      if (!tenantId) return DEFAULT_FINANCIAL_SETTINGS;

      const { data, error } = await supabase
        .from('financial_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar configurações financeiras:", error);
        return DEFAULT_FINANCIAL_SETTINGS;
      }

      if (!data) return DEFAULT_FINANCIAL_SETTINGS;

      return {
        ...DEFAULT_FINANCIAL_SETTINGS,
        ...data,
        feature_flags: data.feature_flags || {}
      } as FinancialSettings;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Helper para verificar se uma feature flag está ativa nas configurações fornecidas.
 */
export function isFeatureActive(settings: FinancialSettings | undefined, flag: string): boolean {
  if (!settings) return false;
  return !!settings.feature_flags?.[flag];
}
