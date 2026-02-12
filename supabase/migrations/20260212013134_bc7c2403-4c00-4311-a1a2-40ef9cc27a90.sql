
-- =====================================================================
-- FACTORY RESET — Zerar dados transacionais preservando config/usuários
-- =====================================================================

-- 1. Desabilitar temporariamente triggers de imutabilidade do audit_logs
DROP TRIGGER IF EXISTS prevent_audit_log_update ON audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_log_delete ON audit_logs;
DROP TRIGGER IF EXISTS guard_audit_log_insert ON audit_logs;

-- 2. TRUNCATE em cascata das tabelas transacionais
TRUNCATE TABLE 
  wa_followup_queue,
  wa_outbox,
  wa_webhook_events,
  wa_messages,
  wa_conversations,
  whatsapp_automation_logs,
  checklist_cliente_arquivos,
  checklist_cliente_respostas,
  checklists_cliente,
  checklist_instalador_arquivos,
  checklist_instalador_respostas,
  checklists_instalador,
  checklists_instalacao,
  comissoes,
  parcelas,
  projetos,
  clientes,
  simulacoes,
  orcamentos,
  leads,
  audit_logs,
  lead_distribution_log,
  usage_events
CASCADE;

-- 3. Resetar sequences de códigos
ALTER SEQUENCE IF EXISTS public.lead_code_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.orcamento_code_seq RESTART WITH 1;

-- 4. Resetar contadores de uso do período
DELETE FROM usage_counters;

-- 5. Recriar triggers de imutabilidade do audit_logs
CREATE TRIGGER prevent_audit_log_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();

CREATE TRIGGER prevent_audit_log_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

CREATE TRIGGER guard_audit_log_insert
  BEFORE INSERT ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION guard_audit_log_insert();
