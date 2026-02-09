
-- =================================================================
-- MIGRATION 001: Fix tenant_id defaults
-- Objetivo: Substituir defaults hardcoded '00000000-0000-0000-0000-000000000001'::uuid
--           e defaults NULL por get_user_tenant_id() em todas as tabelas afetadas.
-- Tabelas afetadas: 57 (33 hardcoded + 24 sem default)
-- Risco: BAIXO — altera apenas o DEFAULT de colunas, não modifica dados existentes
-- Rollback: ALTER TABLE ... ALTER COLUMN tenant_id SET DEFAULT '<valor_anterior>';
-- =================================================================

-- ═══════════════════════════════════════════════════════════════
-- GRUPO A: Tabelas com default hardcoded '0000...0001' (33 tabelas)
-- ═══════════════════════════════════════════════════════════════

-- A1: Configurações
ALTER TABLE config_tributaria_estado ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE financiamento_bancos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE fio_b_escalonamento ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE gamification_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instagram_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instagram_posts ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_metas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_performance_mensal ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE lead_scoring_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE lead_status ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE payback_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE sla_rules ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE webhook_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- A2: Operacionais
ALTER TABLE layouts_solares ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE meta_notifications ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE obras ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE pagamentos_comissao ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE release_checklists ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE task_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE tasks ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE user_roles ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE vendedor_metricas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE vendedor_performance_mensal ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- A3: WhatsApp legado
ALTER TABLE whatsapp_automation_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_automation_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_automation_templates ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversation_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_reminders ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- ═══════════════════════════════════════════════════════════════
-- GRUPO B: Tabelas sem default algum (24 tabelas)
-- Nota: wa_conversation_tags NÃO possui coluna tenant_id — excluída
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lead_links ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE proposal_variables ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE site_servicos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- SolarMarket (13 tabelas)
ALTER TABLE solar_market_clients ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_integration_requests ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_projects ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_proposals ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_items_failed ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_users ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- WhatsApp wa_* (7 tabelas)
ALTER TABLE wa_outbox ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_quick_replies ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_satisfaction_ratings ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- ═══════════════════════════════════════════════════════════════
-- COMENTÁRIOS DE DOCUMENTAÇÃO
-- ═══════════════════════════════════════════════════════════════
COMMENT ON COLUMN config_tributaria_estado.tenant_id IS 'FK para tenants. Default: get_user_tenant_id(). Migrado de hardcoded em 2026-02-09.';
COMMENT ON COLUMN user_roles.tenant_id IS 'FK para tenants. Default: get_user_tenant_id(). Migrado de hardcoded em 2026-02-09.';
COMMENT ON COLUMN lead_status.tenant_id IS 'FK para tenants. Default: get_user_tenant_id(). Migrado de hardcoded em 2026-02-09.';
