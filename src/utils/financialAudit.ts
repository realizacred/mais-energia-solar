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
    .from('pagamentos')
    .select('created_at, data_pagamento, status')
    .eq('id', paymentId)
    .single();

  if (pError || !payment) return { locked: true, reason: 'Pagamento não encontrado' };

  // 2. Verificar trava por dias (se configurado)
  if (lockDays > 0) {
    const paymentDate = new Date(payment.data_pagamento || payment.created_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - paymentDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > lockDays) {
      return { locked: true, reason: `Bloqueado por política de retenção (${lockDays} dias)` };
    }
  }

  // 3. Verificar se está em um caixa fechado
  // Nota: Isso será expandido na fase caixa_v2
  const { data: fechamento } = await supabase
    .from('fechamentos_caixa')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'fechado')
    .filter('data_inicio', 'lte', payment.data_pagamento)
    .filter('data_fim', 'gte', payment.data_pagamento)
    .maybeSingle();

  if (fechamento) {
    return { locked: true, reason: 'Pagamento vinculado a caixa fechado' };
  }

  return { locked: false }; 
}

/**
 * Registra uma ação financeira para fins de auditoria.
 */
export async function logFinancialAction(
  action: 'create' | 'update' | 'delete' | 'storno',
  entity: 'pagamento' | 'recibo' | 'caixa',
  entityId: string,
  details: any
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // No futuro, isso persistirá em uma tabela dedicada 'financial_audit_logs'
  console.log(`[AUDIT] ${action.toUpperCase()} on ${entity} (${entityId}) by ${user.id}`, details);
  
  // Por enquanto, usamos a estrutura de logs existente do sistema se disponível
  // Ou preparamos o insert para a futura tabela
}
