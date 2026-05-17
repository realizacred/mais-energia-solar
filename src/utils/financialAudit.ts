import { supabase } from "@/integrations/supabase/client";

/**
 * Auditoria Global de Transações Financeiras
 * Gatilhos e funções para garantir integridade.
 */

/**
 * Verifica se um pagamento está travado para edição.
 * Baseado no fechamento de caixa ou tempo decorrido (lock_days).
 */
export async function checkFinancialLock(
  paymentId: string, 
  tenantId: string,
  lockDays: number = 0
): Promise<{ locked: boolean; reason?: string }> {
  // 1. Verificar se o pagamento existe e sua data
  const { data: payment, error: pError } = await supabase
    .from('_deprecated_pagamentos' as any)
    .select('created_at, data_pagamento')
    .eq('id', paymentId)
    .single();

  if (pError || !payment) return { locked: true, reason: 'Pagamento não encontrado' };

  const paymentDate = new Date((payment as any).data_pagamento || (payment as any).created_at);
  const paymentDateOnly = paymentDate.toISOString().split('T')[0];

  // 2. Verificar trava por dias (se configurado)
  if (lockDays > 0) {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - paymentDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > lockDays) {
      return { locked: true, reason: `Bloqueado por política de retenção (${lockDays} dias)` };
    }
  }

  // 3. Verificar se está em um caixa fechado
  const { data: fechamento } = await supabase
    .from('fechamentos_caixa')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'fechado')
    .filter('data_inicio', 'lte', paymentDateOnly)
    .filter('data_fim', 'gte', paymentDateOnly)
    .maybeSingle();

  if (fechamento) {
    return { locked: true, reason: 'Pagamento vinculado a caixa fechado' };
  }

  return { locked: false }; 
}

/**
 * Registra uma ação financeira para fins de auditoria.
 * Agora persiste na tabela financial_audit_logs.
 */
export async function logFinancialAction(
  action: string,
  entityType: 'pagamento' | 'recibo' | 'caixa' | 'financial_settings',
  entityId: string,
  details: {
    reason?: string;
    before_data?: any;
    after_data?: any;
    metadata?: any;
  }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!profile?.tenant_id) return;

  const { error } = await supabase.from('financial_audit_logs').insert({
    tenant_id: profile.tenant_id,
    actor_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    action: action,
    reason: details.reason,
    before_data: details.before_data,
    after_data: details.after_data,
    metadata: details.metadata
  });

  if (error) {
    console.error('[AUDIT ERROR]', error);
  }
}
