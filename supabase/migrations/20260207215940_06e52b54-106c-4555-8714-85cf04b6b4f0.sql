
-- =============================================================
-- P1: AUDIT LOGS — TRIGGERS AUTOMÁTICOS
-- Registra INSERT/UPDATE/DELETE em tabelas críticas
-- =============================================================

-- 1) Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _old_data JSONB;
  _new_data JSONB;
  _record_id UUID;
BEGIN
  -- Captura user_id e email do contexto de autenticação
  _user_id := auth.uid();
  _user_email := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    'anonymous'
  );

  -- Determina dados antigos e novos
  IF TG_OP = 'DELETE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := NULL;
    _record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    _old_data := NULL;
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  END IF;

  -- Insere registro de auditoria
  INSERT INTO audit_logs (
    user_id,
    user_email,
    tabela,
    acao,
    registro_id,
    dados_anteriores,
    dados_novos,
    created_at
  ) VALUES (
    _user_id,
    _user_email,
    TG_TABLE_NAME,
    TG_OP,
    _record_id,
    _old_data,
    _new_data,
    now()
  );

  -- Retorna o registro apropriado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 2) Aplica triggers nas tabelas críticas

-- LEADS
DROP TRIGGER IF EXISTS audit_leads ON leads;
CREATE TRIGGER audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- ORÇAMENTOS
DROP TRIGGER IF EXISTS audit_orcamentos ON orcamentos;
CREATE TRIGGER audit_orcamentos
  AFTER INSERT OR UPDATE OR DELETE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- CLIENTES
DROP TRIGGER IF EXISTS audit_clientes ON clientes;
CREATE TRIGGER audit_clientes
  AFTER INSERT OR UPDATE OR DELETE ON clientes
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- PROJETOS
DROP TRIGGER IF EXISTS audit_projetos ON projetos;
CREATE TRIGGER audit_projetos
  AFTER INSERT OR UPDATE OR DELETE ON projetos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- RECEBIMENTOS
DROP TRIGGER IF EXISTS audit_recebimentos ON recebimentos;
CREATE TRIGGER audit_recebimentos
  AFTER INSERT OR UPDATE OR DELETE ON recebimentos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- PARCELAS
DROP TRIGGER IF EXISTS audit_parcelas ON parcelas;
CREATE TRIGGER audit_parcelas
  AFTER INSERT OR UPDATE OR DELETE ON parcelas
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- PAGAMENTOS
DROP TRIGGER IF EXISTS audit_pagamentos ON pagamentos;
CREATE TRIGGER audit_pagamentos
  AFTER INSERT OR UPDATE OR DELETE ON pagamentos
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- COMISSÕES
DROP TRIGGER IF EXISTS audit_comissoes ON comissoes;
CREATE TRIGGER audit_comissoes
  AFTER INSERT OR UPDATE OR DELETE ON comissoes
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- PAGAMENTOS DE COMISSÃO
DROP TRIGGER IF EXISTS audit_pagamentos_comissao ON pagamentos_comissao;
CREATE TRIGGER audit_pagamentos_comissao
  AFTER INSERT OR UPDATE OR DELETE ON pagamentos_comissao
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- SERVIÇOS AGENDADOS
DROP TRIGGER IF EXISTS audit_servicos_agendados ON servicos_agendados;
CREATE TRIGGER audit_servicos_agendados
  AFTER INSERT OR UPDATE OR DELETE ON servicos_agendados
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- CHECKLISTS INSTALADOR
DROP TRIGGER IF EXISTS audit_checklists_instalador ON checklists_instalador;
CREATE TRIGGER audit_checklists_instalador
  AFTER INSERT OR UPDATE OR DELETE ON checklists_instalador
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- VENDEDORES
DROP TRIGGER IF EXISTS audit_vendedores ON vendedores;
CREATE TRIGGER audit_vendedores
  AFTER INSERT OR UPDATE OR DELETE ON vendedores
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- USER_ROLES (mudanças de permissão são críticas)
DROP TRIGGER IF EXISTS audit_user_roles ON user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- PROFILES
DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- 3) Índices para performance em consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela_created 
  ON audit_logs(tabela, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_registro_id 
  ON audit_logs(registro_id);
