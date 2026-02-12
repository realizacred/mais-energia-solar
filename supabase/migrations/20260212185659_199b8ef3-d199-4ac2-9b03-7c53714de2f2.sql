
-- =====================================================
-- BATCH 3: Final NOT NULL enforcement
-- All verified: 0 NULLs in all tables below
-- =====================================================

-- Config tables
ALTER TABLE public.brand_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.calculadora_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.webhook_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.transformadores ALTER COLUMN tenant_id SET NOT NULL;

-- WhatsApp operational
ALTER TABLE public.wa_quick_replies ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.wa_quick_reply_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.wa_tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.wa_satisfaction_ratings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.wa_conversation_preferences ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.whatsapp_automation_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.whatsapp_automation_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.whatsapp_automation_templates ALTER COLUMN tenant_id SET NOT NULL;

-- Vendedor/Gamification
ALTER TABLE public.vendedor_metas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.vendedor_metricas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.vendedor_performance_mensal ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.vendedor_achievements ALTER COLUMN tenant_id SET NOT NULL;

-- Tasks & Links
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.task_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_links ALTER COLUMN tenant_id SET NOT NULL;
