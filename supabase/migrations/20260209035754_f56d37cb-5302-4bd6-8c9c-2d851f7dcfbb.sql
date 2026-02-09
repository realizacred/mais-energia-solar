
-- ============================================================
-- FASE 0.1.1-B: HARDENING DAS FUNÇÕES DE TENANT
-- ============================================================
-- 1) Remove fallback inseguro de get_user_tenant_id()
-- 2) Cria require_tenant_id() com RAISE EXCEPTION
-- 3) Reclassifica defaults de TODAS as tabelas com tenant_id
-- ============================================================

-- ── 1) get_user_tenant_id() → retorna NULL se sem contexto ──
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid DEFAULT auth.uid())
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
  SELECT (SELECT tenant_id FROM profiles WHERE user_id = _user_id LIMIT 1)
$$;

COMMENT ON FUNCTION public.get_user_tenant_id IS
  'Retorna tenant_id do usuário autenticado. Retorna NULL se sem contexto auth ou profile sem tenant. SEM FALLBACK. Fase 0.1.1-B.';

-- ── 2) require_tenant_id() → RAISE EXCEPTION se sem tenant ──
CREATE OR REPLACE FUNCTION public.require_tenant_id(_user_id uuid DEFAULT auth.uid())
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  _tenant uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'require_tenant_id: auth.uid() é NULL. Inserts via service_role devem passar tenant_id explicitamente.'
      USING ERRCODE = 'P0401';
  END IF;

  SELECT tenant_id INTO _tenant
  FROM profiles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'require_tenant_id: Nenhum tenant encontrado para user_id=%. Verifique a tabela profiles.', _user_id
      USING ERRCODE = 'P0402';
  END IF;

  RETURN _tenant;
END;
$$;

COMMENT ON FUNCTION public.require_tenant_id IS
  'Retorna tenant_id ou RAISE EXCEPTION se não encontrar. Use como DEFAULT em tabelas que exigem autenticação. Fase 0.1.1-B.';

-- ── 3) RECLASSIFICAR DEFAULTS ──
-- Legenda:
--   require_tenant_id() = INSERT autenticado obrigatório (operacional + config admin)
--   get_user_tenant_id() = Pode ser NULL (sistema, edge functions, público)
--   DROP DEFAULT          = Deve ser passado explicitamente (site_settings, site_banners)

-- ═══ OPERACIONAL (auth obrigatório) → require_tenant_id() ═══
ALTER TABLE leads ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE orcamentos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE clientes ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE projetos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE vendedores ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE comissoes ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE parcelas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE servicos_agendados ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE propostas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE proposta_itens ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE proposta_variaveis ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE proposal_variables ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE obras ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE recebimentos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE pagamentos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE pagamentos_comissao ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_atividades ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_links ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_scores ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE vendedor_achievements ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE vendedor_metas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE vendedor_metricas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE vendedor_performance_mensal ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE tasks ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE task_events ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE sla_breaches ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE layouts_solares ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE instalador_metas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE instalador_performance_mensal ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();

-- ═══ CHECKLISTS (auth obrigatório) → require_tenant_id() ═══
ALTER TABLE checklists_cliente ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklists_instalador ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklists_instalacao ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_template_items ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_cliente_respostas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_cliente_arquivos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_instalador_respostas ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_instalador_arquivos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();

-- ═══ CONFIG ADMIN (auth obrigatório) → require_tenant_id() ═══
ALTER TABLE calculadora_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE payback_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE financiamento_bancos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE financiamento_api_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE concessionarias ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE brand_settings ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_status ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE checklist_templates ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE gamification_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE instagram_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE instalador_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE motivos_perda ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE config_tributaria_estado ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE solar_market_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_distribution_rules ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE lead_scoring_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE wa_quick_reply_categories ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE wa_quick_replies ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE wa_tags ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE webhook_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE whatsapp_automation_config ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE whatsapp_automation_templates ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE release_checklists ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE sla_rules ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();

-- ═══ SISTEMA / EDGE FUNCTION → get_user_tenant_id() (NULL sem auth) ═══
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE user_roles ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE profiles ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_instances ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_conversations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_outbox ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_satisfaction_ratings ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE meta_notifications ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_integration_requests ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_projects ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_clients ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_proposals ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_items_failed ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_users ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instagram_posts ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE simulacoes ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE fio_b_escalonamento ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE ai_insights ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE lead_distribution_log ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversation_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_reminders ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_automation_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE modulos_fotovoltaicos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE inversores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE baterias ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE disjuntores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE transformadores ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- ═══ PÚBLICO (sem default — deve ser passado explicitamente) ═══
ALTER TABLE site_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE site_banners ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE site_servicos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
