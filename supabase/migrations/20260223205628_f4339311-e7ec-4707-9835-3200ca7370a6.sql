
-- 1) Criar índice crítico em audit_logs(tenant_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);

-- 2) Remover índices não utilizados (identificados via pg_stat_user_indexes com idx_scan = 0)
-- wa_messages: índice redundante (já coberto por outros)
DROP INDEX IF EXISTS idx_wa_messages_tenant_created;

-- audit_logs: user_id raramente filtrado sozinho
DROP INDEX IF EXISTS idx_audit_logs_user_id;
