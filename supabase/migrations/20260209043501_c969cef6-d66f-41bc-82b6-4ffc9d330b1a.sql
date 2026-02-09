
-- ================================================================
-- MIGRATION 004 v2: REMOVER POLICIES LEGADAS (SEM FILTRO TENANT)
-- Fase 0.2 do Plano de Endurecimento Multi-Tenant
-- PRÉ-REQUISITO: Migration 003 v2 já aplicada e validada.
-- ================================================================

-- ============================================================
-- CLASSE A: TENANT_ADMIN_ONLY
-- ============================================================

DROP POLICY IF EXISTS "Admins manage ai_insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Admins read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can manage calculadora_config" ON public.calculadora_config;
DROP POLICY IF EXISTS "Admins manage financiamento_api_config" ON public.financiamento_api_config;
DROP POLICY IF EXISTS "Admins manage instagram_config" ON public.instagram_config;
DROP POLICY IF EXISTS "Admins can manage pagamentos" ON public.pagamentos;
DROP POLICY IF EXISTS "Admins can manage pagamentos_comissao" ON public.pagamentos_comissao;
DROP POLICY IF EXISTS "Admins can manage parcelas" ON public.parcelas;
DROP POLICY IF EXISTS "Admins can manage recebimentos" ON public.recebimentos;
DROP POLICY IF EXISTS "Admins manage release_checklists" ON public.release_checklists;

DROP POLICY IF EXISTS "Admin can delete SM config" ON public.solar_market_config;
DROP POLICY IF EXISTS "Admin can insert SM config" ON public.solar_market_config;
DROP POLICY IF EXISTS "Admin can view SM config" ON public.solar_market_config;
DROP POLICY IF EXISTS "Admin can update SM config" ON public.solar_market_config;

DROP POLICY IF EXISTS "Admins manage webhook_config" ON public.webhook_config;
DROP POLICY IF EXISTS "Admins manage whatsapp_config" ON public.whatsapp_automation_config;
DROP POLICY IF EXISTS "Admins manage whatsapp_logs" ON public.whatsapp_automation_logs;
DROP POLICY IF EXISTS "Admins manage whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Only admins can access webhook events" ON public.wa_webhook_events;


-- ============================================================
-- CLASSE B: TENANT_USER_READ + ADMIN_WRITE
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete baterias" ON public.baterias;
DROP POLICY IF EXISTS "Admins can insert baterias" ON public.baterias;
DROP POLICY IF EXISTS "Authenticated users can read baterias" ON public.baterias;
DROP POLICY IF EXISTS "Admins can update baterias" ON public.baterias;

DROP POLICY IF EXISTS "Admins manage brand_settings" ON public.brand_settings;
DROP POLICY IF EXISTS "Public read brand_settings" ON public.brand_settings;

DROP POLICY IF EXISTS "Admins manage template_items" ON public.checklist_template_items;
DROP POLICY IF EXISTS "Authenticated read template_items" ON public.checklist_template_items;

DROP POLICY IF EXISTS "Admins manage checklist_templates" ON public.checklist_templates;
DROP POLICY IF EXISTS "Authenticated read active templates" ON public.checklist_templates;

DROP POLICY IF EXISTS "Admins manage concessionarias" ON public.concessionarias;
DROP POLICY IF EXISTS "Anon read concessionarias" ON public.concessionarias;
DROP POLICY IF EXISTS "Authenticated read concessionarias" ON public.concessionarias;

DROP POLICY IF EXISTS "Admins manage config_tributaria_estado" ON public.config_tributaria_estado;
DROP POLICY IF EXISTS "Public read config_tributaria_estado" ON public.config_tributaria_estado;

DROP POLICY IF EXISTS "Admins manage disjuntores" ON public.disjuntores;
DROP POLICY IF EXISTS "Authenticated read disjuntores" ON public.disjuntores;

DROP POLICY IF EXISTS "Admins can manage financiamento_bancos" ON public.financiamento_bancos;

DROP POLICY IF EXISTS "Admins manage fio_b_escalonamento" ON public.fio_b_escalonamento;
DROP POLICY IF EXISTS "Public read fio_b_escalonamento" ON public.fio_b_escalonamento;

DROP POLICY IF EXISTS "Admins manage gamification_config" ON public.gamification_config;
DROP POLICY IF EXISTS "Authenticated read gamification_config" ON public.gamification_config;

DROP POLICY IF EXISTS "Admins manage instalador_config" ON public.instalador_config;
DROP POLICY IF EXISTS "Authenticated read instalador_config" ON public.instalador_config;

DROP POLICY IF EXISTS "Admins can delete inversores" ON public.inversores;
DROP POLICY IF EXISTS "Admins can insert inversores" ON public.inversores;
DROP POLICY IF EXISTS "Authenticated users can read inversores" ON public.inversores;
DROP POLICY IF EXISTS "Admins can update inversores" ON public.inversores;

DROP POLICY IF EXISTS "Admins manage lead_scoring_config" ON public.lead_scoring_config;
DROP POLICY IF EXISTS "Authenticated read lead_scoring_config" ON public.lead_scoring_config;

DROP POLICY IF EXISTS "Admins can manage lead_status" ON public.lead_status;
DROP POLICY IF EXISTS "Authenticated can read lead_status" ON public.lead_status;

DROP POLICY IF EXISTS "Admins can delete modulos" ON public.modulos_fotovoltaicos;
DROP POLICY IF EXISTS "Admins can insert modulos" ON public.modulos_fotovoltaicos;
DROP POLICY IF EXISTS "Authenticated users can read modulos" ON public.modulos_fotovoltaicos;
DROP POLICY IF EXISTS "Admins can update modulos" ON public.modulos_fotovoltaicos;

DROP POLICY IF EXISTS "Admins manage payback_config" ON public.payback_config;
DROP POLICY IF EXISTS "Anon read payback_config" ON public.payback_config;
DROP POLICY IF EXISTS "Authenticated read payback_config" ON public.payback_config;

DROP POLICY IF EXISTS "Admins can manage proposal_variables" ON public.proposal_variables;
DROP POLICY IF EXISTS "Authenticated users can read proposal_variables" ON public.proposal_variables;

DROP POLICY IF EXISTS "Admins manage sla_rules" ON public.sla_rules;
DROP POLICY IF EXISTS "Authenticated read sla_rules" ON public.sla_rules;

DROP POLICY IF EXISTS "Admins manage transformadores" ON public.transformadores;
DROP POLICY IF EXISTS "Authenticated read transformadores" ON public.transformadores;

DROP POLICY IF EXISTS "Admins can manage vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated can read vendedores" ON public.vendedores;

DROP POLICY IF EXISTS "Admins can delete quick replies" ON public.wa_quick_replies;
DROP POLICY IF EXISTS "Admins can insert quick replies" ON public.wa_quick_replies;
DROP POLICY IF EXISTS "Authenticated users can read quick replies" ON public.wa_quick_replies;
DROP POLICY IF EXISTS "Admins can update quick replies" ON public.wa_quick_replies;

DROP POLICY IF EXISTS "Admins can manage categories" ON public.wa_quick_reply_categories;
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.wa_quick_reply_categories;

DROP POLICY IF EXISTS "Admins can manage wa_tags" ON public.wa_tags;
DROP POLICY IF EXISTS "Authenticated users can view wa_tags" ON public.wa_tags;

DROP POLICY IF EXISTS "Admins manage whatsapp_templates" ON public.whatsapp_automation_templates;
DROP POLICY IF EXISTS "Authenticated read whatsapp_templates" ON public.whatsapp_automation_templates;

DROP POLICY IF EXISTS "Admins manage tags" ON public.whatsapp_tags;
DROP POLICY IF EXISTS "Authenticated read tags" ON public.whatsapp_tags;


-- ============================================================
-- CLASSE C: TENANT_HYBRID
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage leads" ON public.leads;
DROP POLICY IF EXISTS "Public insert leads with restrictions" ON public.leads;
DROP POLICY IF EXISTS "Users can read leads linked to their wa_conversations" ON public.leads;
DROP POLICY IF EXISTS "Vendedores can read their leads" ON public.leads;

DROP POLICY IF EXISTS "Admins can manage orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Vendedores can delete their orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Public insert orcamentos with restrictions" ON public.orcamentos;
DROP POLICY IF EXISTS "Vendedores can read their orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Vendedores can update their orcamentos" ON public.orcamentos;

DROP POLICY IF EXISTS "Admins can manage clientes" ON public.clientes;
DROP POLICY IF EXISTS "Vendedores can read their clientes" ON public.clientes;

DROP POLICY IF EXISTS "Admins can manage comissoes" ON public.comissoes;
DROP POLICY IF EXISTS "Vendedores can read own comissoes" ON public.comissoes;

DROP POLICY IF EXISTS "Admins can manage projetos" ON public.projetos;
DROP POLICY IF EXISTS "Instaladores can read assigned projetos" ON public.projetos;
DROP POLICY IF EXISTS "Vendedores can read their projetos" ON public.projetos;

DROP POLICY IF EXISTS "Admins podem deletar propostas" ON public.propostas;
DROP POLICY IF EXISTS "Admins podem inserir propostas" ON public.propostas;
DROP POLICY IF EXISTS "Admins podem ver todas as propostas" ON public.propostas;
DROP POLICY IF EXISTS "Vendedores podem ver suas propostas" ON public.propostas;
DROP POLICY IF EXISTS "Admins podem atualizar propostas" ON public.propostas;

DROP POLICY IF EXISTS "Admins podem deletar itens" ON public.proposta_itens;
DROP POLICY IF EXISTS "Admins podem inserir itens" ON public.proposta_itens;
DROP POLICY IF EXISTS "Admins podem ver todos os itens" ON public.proposta_itens;
DROP POLICY IF EXISTS "Vendedores podem ver itens de suas propostas" ON public.proposta_itens;
DROP POLICY IF EXISTS "Admins podem atualizar itens" ON public.proposta_itens;

DROP POLICY IF EXISTS "Admins podem deletar variáveis" ON public.proposta_variaveis;
DROP POLICY IF EXISTS "Admins podem inserir variáveis" ON public.proposta_variaveis;
DROP POLICY IF EXISTS "Admins podem ver todas as variáveis" ON public.proposta_variaveis;
DROP POLICY IF EXISTS "Vendedores podem ver variáveis de suas propostas" ON public.proposta_variaveis;
DROP POLICY IF EXISTS "Admins podem atualizar variáveis" ON public.proposta_variaveis;

DROP POLICY IF EXISTS "Admins manage lead_atividades" ON public.lead_atividades;
DROP POLICY IF EXISTS "Vendedores manage own atividades" ON public.lead_atividades;

DROP POLICY IF EXISTS "Admins manage lead_scores" ON public.lead_scores;
DROP POLICY IF EXISTS "Vendedores read lead_scores" ON public.lead_scores;

DROP POLICY IF EXISTS "Admin can manage lead links" ON public.lead_links;
DROP POLICY IF EXISTS "Service role full access lead links" ON public.lead_links;

DROP POLICY IF EXISTS "Admins can manage servicos" ON public.servicos_agendados;
DROP POLICY IF EXISTS "Instaladores can read own servicos" ON public.servicos_agendados;
DROP POLICY IF EXISTS "Instaladores can update own servicos" ON public.servicos_agendados;

DROP POLICY IF EXISTS "Admins manage checklists_cliente" ON public.checklists_cliente;

DROP POLICY IF EXISTS "Admins manage cl_cliente_arquivos" ON public.checklist_cliente_arquivos;

DROP POLICY IF EXISTS "Admins manage cl_cliente_respostas" ON public.checklist_cliente_respostas;

DROP POLICY IF EXISTS "Admins manage meta_notifications" ON public.meta_notifications;
DROP POLICY IF EXISTS "Vendedores manage own notifications" ON public.meta_notifications;

DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users read assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users update assigned tasks" ON public.tasks;

DROP POLICY IF EXISTS "Admins manage task_events" ON public.task_events;
DROP POLICY IF EXISTS "Users read own task events" ON public.task_events;

DROP POLICY IF EXISTS "Admins manage obras" ON public.obras;
DROP POLICY IF EXISTS "Public read active obras" ON public.obras;

DROP POLICY IF EXISTS "Admins manage instalador_metas" ON public.instalador_metas;
DROP POLICY IF EXISTS "Instaladores read own metas" ON public.instalador_metas;

DROP POLICY IF EXISTS "Admins manage instalador_performance" ON public.instalador_performance_mensal;
DROP POLICY IF EXISTS "Instaladores read own performance" ON public.instalador_performance_mensal;

DROP POLICY IF EXISTS "Admins manage vendedor_achievements" ON public.vendedor_achievements;
DROP POLICY IF EXISTS "Vendedores read own achievements" ON public.vendedor_achievements;

DROP POLICY IF EXISTS "Admins manage vendedor_metas" ON public.vendedor_metas;
DROP POLICY IF EXISTS "Vendedores read own metas" ON public.vendedor_metas;

DROP POLICY IF EXISTS "Admins manage vendedor_metricas" ON public.vendedor_metricas;
DROP POLICY IF EXISTS "Vendedores read own metricas" ON public.vendedor_metricas;

DROP POLICY IF EXISTS "Admins manage vendedor_performance" ON public.vendedor_performance_mensal;
DROP POLICY IF EXISTS "Vendedores read own performance" ON public.vendedor_performance_mensal;


-- ============================================================
-- CLASSE D: TENANT_OWNER_ONLY
-- ============================================================

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

DROP POLICY IF EXISTS "Admins manage checklists_instalacao" ON public.checklists_instalacao;
DROP POLICY IF EXISTS "Instaladores manage own instalacao" ON public.checklists_instalacao;

DROP POLICY IF EXISTS "Admins manage checklists_instalador" ON public.checklists_instalador;
DROP POLICY IF EXISTS "Instaladores read own checklists" ON public.checklists_instalador;
DROP POLICY IF EXISTS "Instaladores update own checklists" ON public.checklists_instalador;

DROP POLICY IF EXISTS "Admins manage cl_instalador_arquivos" ON public.checklist_instalador_arquivos;
DROP POLICY IF EXISTS "Instaladores manage own arquivos" ON public.checklist_instalador_arquivos;

DROP POLICY IF EXISTS "Admins manage cl_instalador_respostas" ON public.checklist_instalador_respostas;
DROP POLICY IF EXISTS "Instaladores manage own respostas" ON public.checklist_instalador_respostas;

DROP POLICY IF EXISTS "Admins manage layouts_solares" ON public.layouts_solares;
DROP POLICY IF EXISTS "Instaladores manage own layouts" ON public.layouts_solares;

DROP POLICY IF EXISTS "Admins manage whatsapp_reminders" ON public.whatsapp_reminders;
DROP POLICY IF EXISTS "Vendedores manage own reminders" ON public.whatsapp_reminders;


-- ============================================================
-- CLASSE E: SERVICE_ONLY + ADMIN_READ
-- ============================================================

DROP POLICY IF EXISTS "Admins manage instagram_posts" ON public.instagram_posts;
DROP POLICY IF EXISTS "Public read instagram_posts" ON public.instagram_posts;

DROP POLICY IF EXISTS "Admin can manage SM clients" ON public.solar_market_clients;
DROP POLICY IF EXISTS "Service role full access SM clients" ON public.solar_market_clients;

DROP POLICY IF EXISTS "Admins can manage SM custom fields" ON public.solar_market_custom_fields;

DROP POLICY IF EXISTS "Admins can manage SM custom fields catalog" ON public.solar_market_custom_fields_catalog;

DROP POLICY IF EXISTS "Admin can manage SM funnels" ON public.solar_market_funnels;
DROP POLICY IF EXISTS "Service role full access SM funnels" ON public.solar_market_funnels;

DROP POLICY IF EXISTS "Admins can manage SM funnels catalog" ON public.solar_market_funnels_catalog;

DROP POLICY IF EXISTS "Service role can insert integration requests" ON public.solar_market_integration_requests;
DROP POLICY IF EXISTS "Admins can view integration requests" ON public.solar_market_integration_requests;

DROP POLICY IF EXISTS "Admin can manage SM projects" ON public.solar_market_projects;
DROP POLICY IF EXISTS "Service role full access SM projects" ON public.solar_market_projects;

DROP POLICY IF EXISTS "Admin can manage SM proposals" ON public.solar_market_proposals;
DROP POLICY IF EXISTS "Service role full access SM proposals" ON public.solar_market_proposals;

DROP POLICY IF EXISTS "Service role can insert sync items failed" ON public.solar_market_sync_items_failed;
DROP POLICY IF EXISTS "Admins can view sync items failed" ON public.solar_market_sync_items_failed;

DROP POLICY IF EXISTS "Service role full access SM sync logs" ON public.solar_market_sync_logs;
DROP POLICY IF EXISTS "Admin can view SM sync logs" ON public.solar_market_sync_logs;

DROP POLICY IF EXISTS "Admins can manage SM users" ON public.solar_market_users;

DROP POLICY IF EXISTS "Admins can manage SM webhook events" ON public.solar_market_webhook_events;
DROP POLICY IF EXISTS "Service role full access SM webhook events" ON public.solar_market_webhook_events;
DROP POLICY IF EXISTS "Admin can view SM webhook events" ON public.solar_market_webhook_events;


-- ============================================================
-- CLASSE F: WHATSAPP_HYBRID
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage all instances" ON public.wa_instances;
DROP POLICY IF EXISTS "Vendors can view own instances" ON public.wa_instances;

DROP POLICY IF EXISTS "Admins can manage all wa_conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "Vendors can view conversations of own instances" ON public.wa_conversations;
DROP POLICY IF EXISTS "Vendors can update assigned conversations" ON public.wa_conversations;

DROP POLICY IF EXISTS "Admins can manage all wa_messages" ON public.wa_messages;
DROP POLICY IF EXISTS "Vendors can insert messages on accessible conversations" ON public.wa_messages;
DROP POLICY IF EXISTS "Vendors can view messages of accessible conversations" ON public.wa_messages;

DROP POLICY IF EXISTS "Admins can manage outbox" ON public.wa_outbox;
DROP POLICY IF EXISTS "Vendors can insert into outbox for own instances" ON public.wa_outbox;
DROP POLICY IF EXISTS "Vendors can view own outbox items" ON public.wa_outbox;

DROP POLICY IF EXISTS "Admins can manage wa_transfers" ON public.wa_transfers;
DROP POLICY IF EXISTS "Vendors can view own transfers" ON public.wa_transfers;

DROP POLICY IF EXISTS "Admins manage conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Vendors read assigned conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Vendors update assigned conversations" ON public.whatsapp_conversations;

DROP POLICY IF EXISTS "Admins manage conversation messages" ON public.whatsapp_conversation_messages;
DROP POLICY IF EXISTS "Vendors insert messages in assigned conversations" ON public.whatsapp_conversation_messages;
DROP POLICY IF EXISTS "Vendors read messages of assigned conversations" ON public.whatsapp_conversation_messages;

DROP POLICY IF EXISTS "Admins manage transfers" ON public.whatsapp_transfers;
DROP POLICY IF EXISTS "Vendors read own transfers" ON public.whatsapp_transfers;


-- ============================================================
-- CLASSE G: PUBLIC_INSERT
-- ============================================================

DROP POLICY IF EXISTS "Admins manage simulacoes" ON public.simulacoes;
DROP POLICY IF EXISTS "Public insert simulacoes with restrictions" ON public.simulacoes;


-- ============================================================
-- CLASSE H: SITE_PUBLIC
-- ============================================================

DROP POLICY IF EXISTS "Admins podem deletar serviços" ON public.site_servicos;
DROP POLICY IF EXISTS "Admins podem inserir serviços" ON public.site_servicos;
DROP POLICY IF EXISTS "Serviços visíveis publicamente" ON public.site_servicos;
DROP POLICY IF EXISTS "Admins podem atualizar serviços" ON public.site_servicos;
