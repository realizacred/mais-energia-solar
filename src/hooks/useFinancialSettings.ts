import { supabase } from "@/integrations/supabase/client";

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

export const DEFAULT_FINANCIAL_SETTINGS: Partial<FinancialSettings> = {
  receipt_auto_emit: true,
  receipt_allow_standalone: true,
  receipt_auto_numbering: true,
  receipt_show_qrcode: true,
  cash_lock_on_close: true,
  commission_trigger: 'payment_cleared',
  audit_allow_hard_delete: false,
};

/**
 * Busca as configurações financeiras do tenant atual.
 */
export async function getFinancialSettings(tenantId: string): Promise<FinancialSettings> {
  const { data, error } = await supabase
    .from('financial_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error("Erro ao buscar configurações financeiras:", error);
    return DEFAULT_FINANCIAL_SETTINGS as FinancialSettings;
  }

  return data as FinancialSettings;
}

/**
 * Helper para verificar se uma feature flag está ativa para o tenant.
 */
export function isFeatureActive(settings: FinancialSettings, flag: string): boolean {
  return !!settings.feature_flags?.[flag];
}
