# 📚 Base de Conhecimento Canônica — CRM Solar SaaS Multi-Tenant

> Gerada em 2026-02-13 via auditoria automatizada do banco, código e edge functions.

---

## 1. Visão Geral

**Produto**: CRM SaaS multi-tenant para empresas de energia solar.  
**Stack**: React + Vite + Tailwind + TypeScript (frontend), Supabase (backend: Postgres, Auth, Edge Functions, Realtime, Storage).  
**Modelo de Tenant**: Isolamento por `tenant_id` em 100% das tabelas públicas com RLS obrigatório.  
**Roles**: `super_admin` (global), `admin`, `gerente`, `financeiro`, `vendedor`→`consultor`, `instalador` (por tenant).  
**Portais**: Super Admin (`/super-admin`), Admin (`/admin`), Consultor (`/consultor`), Instalador (`/instalador`), Público (site/calculadora).

---

## 2. Domínios

### 2.1 WhatsApp Inbox
- **Objetivo**: Centralizar atendimento via WhatsApp com Evolution API.
- **Fluxos**: Webhook recebe msg → `evolution-webhook` → `wa_webhook_events` → `process-webhook-events` → cria/atualiza `wa_conversations` + `wa_messages` → Realtime atualiza UI.
- **Telas**: `/admin/inbox` (admin), `/inbox` (PWA consultor standalone).
- **Edge Functions**: `evolution-webhook`, `process-webhook-events`, `send-whatsapp-message`, `send-wa-reaction`, `send-wa-welcome`, `sync-wa-history`, `sync-wa-profile-pictures`, `check-wa-instance-status`, `test-evolution-connection`.
- **Cron**: Nenhum direto (processamento via webhook).
- **Webhooks**: Evolution API → `evolution-webhook`.

### 2.2 Follow-up & Automações WA
- **Objetivo**: Acompanhamento automatizado de conversas/leads via regras de tempo.
- **Fluxos**: Regras em `wa_followup_rules` → cron dispara `process-wa-followups` a cada 2min → insere em `wa_followup_queue` → envia mensagem via `send-whatsapp-message`.
- **Telas**: `/admin/followup-queue`, `/admin/followup-wa`.
- **Edge Functions**: `process-wa-followups`, `ai-followup-planner`.
- **Cron**: `process-wa-followups` (*/2 * * * *).

### 2.3 Automações WhatsApp (Templates)
- **Objetivo**: Envio automático de boas-vindas e notificação de orçamento via templates customizáveis.
- **Fluxos**: Novo orçamento → trigger → `process-whatsapp-automations` → `send-whatsapp-message`.
- **Telas**: `/admin/whatsapp` (config de templates).
- **Edge Functions**: `process-whatsapp-automations`.
- **Tabelas-chave**: `whatsapp_automation_config`, `whatsapp_automation_templates`, `whatsapp_automation_logs`.

### 2.4 Leads & Pipeline
- **Objetivo**: Captura, qualificação e gestão de leads solares.
- **Fluxos**: Formulário público → `public-create-lead` ou insert direto (trigger resolve tenant) → lead na fila → distribuição → consultor atende.
- **Telas**: `/admin/leads`, `/admin/pipeline`, `/admin/distribuicao`, `/admin/sla-breaches`, `/admin/inteligencia`.
- **Edge Functions**: `public-create-lead`, `lead-scoring`, `webhook-lead`.
- **Tabelas-chave**: `leads`, `lead_status`, `lead_atividades`, `lead_scores`, `lead_scoring_config`, `lead_distribution_rules`, `lead_distribution_log`, `lead_links`, `motivos_perda`.

### 2.5 Propostas & Orçamentos
- **Objetivo**: Geração de orçamentos/propostas comerciais com simulação solar.
- **Fluxos**: Lead → criar orçamento (calc solar) → gerar proposta PDF → enviar ao cliente.
- **Telas**: `/admin/propostas`.
- **Edge Functions**: `ai-proposal-explainer`.
- **Tabelas-chave**: `orcamentos`, `propostas`, `proposta_itens`, `proposta_variaveis`, `proposal_variables`, `simulacoes`.

### 2.6 Clientes & Projetos
- **Objetivo**: Gestão pós-venda: documentação, instalação, acompanhamento.
- **Fluxos**: Lead convertido → cliente → projeto → checklist → instalação → avaliação.
- **Telas**: `/admin/clientes`, `/admin/checklists`, `/admin/servicos`, `/admin/avaliacoes`.
- **Tabelas-chave**: `clientes`, `projetos`, `servicos_agendados`, `checklists_cliente`, `checklist_cliente_respostas`, `checklist_cliente_arquivos`, `checklists_instalador`, `checklist_instalador_respostas`, `checklist_instalador_arquivos`, `checklist_templates`, `checklist_template_items`.

### 2.7 Agenda & Compromissos
- **Objetivo**: Agendamento interno + sincronização opcional com Google Calendar.
- **Fluxos**: Criar compromisso (via Inbox ou manual) → `appointments` → sync → `google_calendar_events` (espelho).
- **Telas**: `/admin/agenda-config`, consultor agenda view.
- **Edge Functions**: `google-calendar-sync`, `google-calendar-poll`, `google-calendar-read`, `google-calendar-auth`, `google-calendar-callback`, `retry-failed-calendar-sync`.
- **Cron**: `retry-failed-calendar-sync` (*/10 * * * *), `google-calendar-poll-10min` (*/10 * * * *).

### 2.8 Financeiro
- **Objetivo**: Controle de pagamentos, parcelas, comissões.
- **Fluxos**: Projeto vendido → criar pagamento → gerar parcelas → acompanhar recebimentos → calcular comissões.
- **Telas**: `/admin/recebimentos`, `/admin/inadimplencia`, `/admin/comissoes`, `/admin/engenharia`, `/admin/financiamento`.
- **Tabelas-chave**: `pagamentos`, `pagamentos_comissao`, `parcelas`, `recebimentos`, `comissoes`, `financiamento_bancos`, `financiamento_api_config`, `payback_config`, `fio_b_escalonamento`.

### 2.9 Consultores & Gamificação
- **Objetivo**: Gestão da equipe comercial com metas, ranking e conquistas.
- **Telas**: `/admin/vendedores`, `/admin/gamificacao`, `/consultor` (portal).
- **Tabelas-chave**: `consultores`, `consultor_metas`, `consultor_metricas`, `consultor_performance_mensal`, `consultor_achievements`, `gamification_config`.

### 2.10 Instaladores
- **Objetivo**: Gestão da equipe de campo.
- **Telas**: `/admin/instaladores`, `/instalador` (portal).
- **Tabelas-chave**: `instalador_config`, `instalador_metas`, `instalador_performance_mensal`, `checklists_instalacao`, `checklists_instalador`.

### 2.11 Site Público & Calculadora
- **Objetivo**: Landing page e calculadora solar pública por tenant.
- **Telas**: `/` (Index), `/calculadora`, `/v/:slug` (link consultor), `/avaliacao`.
- **Edge Functions**: Nenhuma dedicada (usa RPCs: `get_calculator_config`, `get_concessionarias_por_estado`, etc.).
- **Tabelas-chave**: `site_settings`, `site_banners`, `site_servicos`, `obras`, `brand_settings`, `calculadora_config`, `simulacoes`.

### 2.12 Integrações Externas
- **Objetivo**: Conectar serviços terceiros.
- **Subdomínios**:
  - **Instagram**: `instagram-sync` → `instagram_posts`.
  - **SolarMarket**: `solar-market-sync`, `solar-market-webhook`, `solar-market-auth` → `solar_market_*` (13 tabelas).
  - **ANEEL**: `sync-tarifas-aneel` → `concessionarias`.
  - **BCB**: `sync-taxas-bcb` → `financiamento_bancos`.
- **Telas**: `/admin/integracoes-status`, `/admin/wa-instances`, `/admin/instagram`, `/admin/solarmarket`, `/admin/webhooks`.

### 2.13 IA & Copilot
- **Objetivo**: Sugestões, resumos, scoring, insights automatizados.
- **Edge Functions**: `ai-suggest-message`, `ai-conversation-summary`, `ai-followup-planner`, `generate-ai-insights`, `ai-proposal-explainer`. (~~`loading-ai-message`~~ deletada em 2026-02-15)
- **Telas**: `/admin/diretor`, `/admin/ai-config`.
- **Tabelas-chave**: `ai_insights`, `wa_ai_settings`, `wa_ai_tasks`.

### 2.14 Notificações
- **Objetivo**: Alertas in-app e push para eventos críticos.
- **Edge Functions**: `send-push-notification`, `register-push-subscription`, `generate-vapid-keys`.
- **Tabelas-chave**: `push_subscriptions`, `push_preferences`, `push_sent_log`, `push_muted_conversations`, `meta_notifications`, `notification_config`.

### 2.15 Billing & Planos (Super Admin)
- **Objetivo**: Gestão de planos SaaS, limites e uso.
- **Telas**: `/super-admin`.
- **Edge Functions**: `create-tenant`.
- **Tabelas-chave**: `tenants`, `plans`, `plan_limits`, `plan_features`, `subscriptions`, `usage_counters`, `usage_events`.

### 2.16 Auditoria & Logs
- **Objetivo**: Rastreabilidade completa de alterações.
- **Tabelas-chave**: `audit_logs` (imutável via triggers de proteção), `dead_letter_queue`.
- **Telas**: `/admin/auditoria`.

### 2.17 Usuários & Auth
- **Objetivo**: Autenticação, perfis e controle de acesso.
- **Edge Functions**: `create-vendedor-user`, `activate-vendor-account`, `delete-user`, `update-user-email`, `list-users-emails`.
- **Tabelas-chave**: `profiles`, `user_roles`, `user_feature_permissions`, `vendor_invites`.
- **Telas**: `/auth`, `/admin/usuarios`, `/admin/aprovacao`, `/ativar-conta`, `/pendente`.

---

## 3. Tabelas & RLS

### 3.1 Inventário Completo (134 tabelas)

| # | Tabela | Finalidade | tenant_id | Default | RLS Policies |
|---|--------|-----------|-----------|---------|--------------|
| 1 | `agenda_config` | Config agenda por tenant | NOT NULL | `get_user_tenant_id()` | 3 |
| 2 | `agenda_sync_logs` | Logs sync Google Cal | NOT NULL | `get_user_tenant_id()` | 2 |
| 3 | `ai_insights` | Insights IA gerados | NOT NULL | `get_user_tenant_id()` | 1 |
| 4 | `appointments` | Compromissos/agendamentos | NOT NULL | `get_user_tenant_id()` | 4 |
| 5 | `audit_logs` | Logs de auditoria (imutável) | NOT NULL | `get_user_tenant_id()` | 2 |
| 6 | `backfill_audit` | Rastreamento de backfills | — | — | 1 |
| 7 | `baterias` | Catálogo de baterias | NOT NULL | `get_user_tenant_id()` | 4 |
| 8 | `brand_settings` | Cores/logo por tenant | NOT NULL | `require_tenant_id()` | 2 |
| 9 | `calculadora_config` | Params da calculadora solar | NOT NULL | `require_tenant_id()` | 1 |
| 10 | `checklist_cliente_arquivos` | Arquivos de checklist cliente | NOT NULL | `require_tenant_id()` | 1 |
| 11 | `checklist_cliente_respostas` | Respostas checklist cliente | NOT NULL | `require_tenant_id()` | 1 |
| 12 | `checklist_instalador_arquivos` | Arquivos checklist instalador | NOT NULL | `require_tenant_id()` | 2 |
| 13 | `checklist_instalador_respostas` | Respostas checklist instalador | NOT NULL | `require_tenant_id()` | 2 |
| 14 | `checklist_template_items` | Itens dos templates | NOT NULL | `require_tenant_id()` | 2 |
| 15 | `checklist_templates` | Templates de checklist | NOT NULL | `require_tenant_id()` | 2 |
| 16 | `checklists_cliente` | Checklists de cliente | NOT NULL | `require_tenant_id()` | 1 |
| 17 | `checklists_instalacao` | Checklists instalação (legado) | NOT NULL | `require_tenant_id()` | 2 |
| 18 | `checklists_instalador` | Checklists por instalador | NOT NULL | `require_tenant_id()` | 3 |
| 19 | `clientes` | Cadastro de clientes | NOT NULL | `require_tenant_id()` | 2 |
| 20 | `comissoes` | Comissões de consultores | NOT NULL | `require_tenant_id()` | 2 |
| 21 | `concessionarias` | Distribuidoras de energia | NOT NULL | `require_tenant_id()` | 3 |
| 22 | `config_tributaria_estado` | Config ICMS por estado | NULLABLE | `require_tenant_id()` | 2 |
| 23 | `consultor_achievements` | Conquistas gamificação | NOT NULL | `require_tenant_id()` | 2 |
| 24 | `consultor_metas` | Metas mensais consultor | NOT NULL | `require_tenant_id()` | 2 |
| 25 | `consultor_metricas` | Métricas consolidadas | NOT NULL | `require_tenant_id()` | 2 |
| 26 | `consultor_performance_mensal` | Performance mensal | NOT NULL | `require_tenant_id()` | 2 |
| 27 | `consultores` | Cadastro de consultores | NOT NULL | `require_tenant_id()` | 2 |
| 28 | `custo_faixas_kwp` | Faixas de custo por kWp | NOT NULL | (nenhum) | 2 |
| 29 | `dead_letter_queue` | Fila de erros para retry | NOT NULL | (nenhum) | 3 |
| 30 | `disjuntores` | Catálogo disjuntores | NOT NULL | `get_user_tenant_id()` | 2 |
| 31 | `edge_rate_limits` | Rate limiting de edge funcs | NULLABLE | — | 1 |
| 32 | `financiamento_api_config` | Config API financiamento | NOT NULL | `require_tenant_id()` | 1 |
| 33 | `financiamento_bancos` | Bancos para financiamento | NOT NULL | `require_tenant_id()` | 1 |
| 34 | `fio_b_escalonamento` | Escalonamento fio B | NOT NULL | `get_user_tenant_id()` | 2 |
| 35 | `gamification_config` | Config gamificação | NOT NULL | `require_tenant_id()` | 2 |
| 36 | `google_calendar_events` | Espelho eventos Google | NOT NULL | (nenhum) | 4 |
| 37 | `google_calendar_tokens` | OAuth tokens Google | NOT NULL | (nenhum) | 5 |
| 38 | `instagram_config` | Config Instagram | NOT NULL | `require_tenant_id()` | 1 |
| 39 | `instagram_posts` | Posts sincronizados | NOT NULL | `get_user_tenant_id()` | 3 |
| 40 | `instalador_config` | Config portal instalador | NOT NULL | `require_tenant_id()` | 2 |
| 41 | `instalador_metas` | Metas instalador | NOT NULL | `require_tenant_id()` | 2 |
| 42 | `instalador_performance_mensal` | Performance instalador | NOT NULL | `require_tenant_id()` | 2 |
| 43 | `integration_configs` | Chaves API integrações | NOT NULL | (nenhum) | 4 |
| 44 | `inversores` | Catálogo inversores | NOT NULL | `get_user_tenant_id()` | 4 |
| 45 | `inversores_catalogo` | Catálogo global inversores | NULLABLE | — | 4 |
| 46 | `irradiacao_por_estado` | Irradiação solar/estado | NULLABLE | — | 2 |
| 47 | `layouts_solares` | Layouts de painéis | NOT NULL | `require_tenant_id()` | 2 |
| 48 | `lead_atividades` | Histórico atividades lead | NOT NULL | `require_tenant_id()` | 2 |
| 49 | `lead_distribution_log` | Log de distribuição | NOT NULL | `require_tenant_id()` | 2 |
| 50 | `lead_distribution_rules` | Regras de distribuição | NOT NULL | `require_tenant_id()` | 2 |
| 51 | `lead_links` | Links de captação | NOT NULL | `require_tenant_id()` | 2 |
| 52 | `lead_scores` | Scores calculados | NOT NULL | `require_tenant_id()` | 2 |
| 53 | `lead_scoring_config` | Config scoring | NOT NULL | `require_tenant_id()` | 2 |
| 54 | `lead_status` | Status do funil | NOT NULL | `require_tenant_id()` | 2 |
| 55 | `leads` | Leads (fonte principal) | NOT NULL | `require_tenant_id()` | 4 |
| 56 | `loading_config` | Config tela de loading | NOT NULL | `get_user_tenant_id()` | 3 |
| 57 | `meta_notifications` | Notificações de metas | NOT NULL | `require_tenant_id()` | 2 |
| 58 | `modulos_fotovoltaicos` | Catálogo módulos | NOT NULL | `get_user_tenant_id()` | 4 |
| 59 | `modulos_solares` | Catálogo módulos (v2) | NOT NULL | `get_user_tenant_id()` | 4 |
| 60 | `motivos_perda` | Motivos de perda de lead | NOT NULL | `get_user_tenant_id()` | 4 |
| 61 | `nav_overrides` | Customização menu por tenant | NOT NULL | `get_user_tenant_id()` | 4 |
| 62 | `notification_config` | Config notificações tenant | NOT NULL | `get_user_tenant_id()` | 2 |
| 63 | `obras` | Portfólio de obras | NOT NULL | `require_tenant_id()` | 2 |
| 64 | `orcamentos` | Orçamentos solares | NOT NULL | `require_tenant_id()` | 5 |
| 65 | `pagamentos` | Pagamentos | NOT NULL | `require_tenant_id()` | 1 |
| 66 | `pagamentos_comissao` | Pag. de comissões | NOT NULL | `require_tenant_id()` | 1 |
| 67 | `parcelas` | Parcelas de pagamento | NOT NULL | `require_tenant_id()` | 1 |
| 68 | `payback_config` | Config payback | NOT NULL | `require_tenant_id()` | 2 |
| 69 | `plan_features` | Features por plano | — | — | 2 |
| 70 | `plan_limits` | Limites por plano | — | — | 2 |
| 71 | `plans` | Planos SaaS | — | — | 2 |
| 72 | `profiles` | Perfis de usuário | NOT NULL | `get_user_tenant_id()` | 4 |
| 73 | `projetos` | Projetos solares | NOT NULL | `require_tenant_id()` | 3 |
| 74 | `proposal_variables` | Variáveis de proposta | NOT NULL | `require_tenant_id()` | 2 |
| 75 | `proposta_itens` | Itens da proposta | NOT NULL | `require_tenant_id()` | 2 |
| 76 | `proposta_variaveis` | Variáveis por proposta | NOT NULL | `require_tenant_id()` | 2 |
| 77 | `propostas` | Propostas comerciais | NOT NULL | `require_tenant_id()` | 2 |
| 78 | `push_muted_conversations` | Conversas mutadas | — | — | 1 |
| 79 | `push_preferences` | Preferências push user | — | — | 3 |
| 80 | `push_sent_log` | Log de push enviados | — | — | 1 |
| 81 | `push_subscriptions` | Inscrições push | — | — | 5 |
| 82 | `recebimentos` | Recebimentos financeiros | NOT NULL | `require_tenant_id()` | 1 |
| 83 | `release_checklists` | Checklist de releases | NOT NULL | `require_tenant_id()` | 1 |
| 84 | `servicos_agendados` | Serviços técnicos agendados | NOT NULL | `require_tenant_id()` | 3 |
| 85 | `simulacoes` | Simulações solares públicas | NOT NULL | `require_tenant_id()` | 2 |
| 86 | `site_banners` | Banners do site | NOT NULL | `get_user_tenant_id()` | 3 |
| 87 | `site_servicos` | Serviços exibidos no site | NOT NULL | `get_user_tenant_id()` | 2 |
| 88 | `site_settings` | Config do site público | NOT NULL | `get_user_tenant_id()` | 3 |
| 89 | `sla_breaches` | Violações de SLA | NOT NULL | `require_tenant_id()` | 4 |
| 90 | `sla_rules` | Regras de SLA | NOT NULL | `require_tenant_id()` | 2 |
| 91-103 | `solar_market_*` (13 tabelas) | Integração SolarMarket | NOT NULL | variado | 1-2 cada |
| ~~104~~ | ~~`storage_migration_log`~~ | ~~Log migração storage~~ | — | — | **DELETADA** (2026-02-15) |
| 105 | `subscriptions` | Assinaturas de plano | NOT NULL | — | 2 |
| 106 | `task_events` | Eventos de tarefas | NOT NULL | `require_tenant_id()` | 2 |
| 107 | `tasks` | Tarefas operacionais | NOT NULL | `require_tenant_id()` | 2 |
| 108 | `tenants` | Empresas (tenants) | PK (id) | — | 2 |
| 109 | `transformadores` | Catálogo transformadores | NOT NULL | `get_user_tenant_id()` | 2 |
| 110 | `usage_counters` | Contadores de uso | NOT NULL | — | 2 |
| 111 | `usage_events` | Eventos de uso | NOT NULL | — | 1 |
| 112 | `user_feature_permissions` | Permissões granulares | — | — | 2 |
| 113 | `user_roles` | Roles dos usuários | NOT NULL | — | 5 |
| 114 | `vendor_invites` | Convites para consultores | NOT NULL | — | 2 |
| 115 | `wa_ai_settings` | Config IA por tenant WA | NOT NULL | — | 2 |
| 116 | `wa_ai_tasks` | Tarefas IA WA | NOT NULL | — | 2 |
| 117 | `wa_conversation_preferences` | Prefs por conversa | — | — | DESCONHECIDO |
| 118 | `wa_conversation_tags` | Tags em conversas | — | — | 2 |
| 119 | `wa_conversations` | Conversas WhatsApp | NOT NULL | — | 5 |
| 120 | `wa_followup_queue` | Fila de follow-ups | NOT NULL | — | 3 |
| 121 | `wa_followup_rules` | Regras de follow-up | NOT NULL | — | 3 |
| 122 | `wa_health_checks` | Health check instâncias | NOT NULL | — | 2 |
| 123 | `wa_instance_consultores` | Consultores por instância | NOT NULL | — | 2 |
| 124 | `wa_instances` | Instâncias Evolution API | NOT NULL | — | 3 |
| 125 | `wa_message_hidden` | Msgs ocultadas por user | — | — | DESCONHECIDO |
| 126 | `wa_messages` | Mensagens WhatsApp | NOT NULL | — | 3 |
| 127 | `wa_outbox` | Fila de envio | NOT NULL | — | 2 |
| 128 | `wa_quick_replies` | Respostas rápidas | NOT NULL | — | 2 |
| 129 | `wa_quick_reply_categories` | Categorias resp. rápidas | NOT NULL | — | 2 |
| 130 | `wa_reads` | Status de leitura | — | — | DESCONHECIDO |
| 131 | `wa_satisfaction_ratings` | Avaliações satisfação | NOT NULL | — | 2 |
| 132 | `wa_tags` | Tags globais WA | NOT NULL | — | 2 |
| 133 | `wa_transfers` | Transferências de conversa | NOT NULL | — | 2 |
| 134 | `wa_webhook_events` | Eventos webhook raw | NOT NULL | — | 2 |
| 135 | `webhook_config` | Config webhooks externos | NOT NULL | `require_tenant_id()` | 1 |
| 136 | `whatsapp_automation_config` | Config automação WA | NOT NULL | `require_tenant_id()` | 1 |
| 137 | `whatsapp_automation_logs` | Logs automação WA | NOT NULL | `get_user_tenant_id()` | 1 |
| 138 | `whatsapp_automation_templates` | Templates automação | NOT NULL | `require_tenant_id()` | 2 |

> **Nota**: Tabelas `plans`, `plan_limits`, `plan_features` são globais (sem tenant_id — dados do SaaS).

---

## 4. Sources of Truth

| Domínio | Fonte de Verdade | Observação |
|---------|-----------------|------------|
| Conversas WA | `wa_conversations` | ✅ Única fonte |
| Mensagens WA | `wa_messages` | ✅ Única fonte |
| Contatos/Leads | `leads` | ✅ Única fonte |
| Clientes | `clientes` (via `lead_id` FK) | ✅ Única fonte |
| Responsável lead | `leads.consultor_id` → FK `consultores` | ✅ |
| Responsável conversa | `wa_conversations.assigned_to` → `auth.users.id` | ✅ |
| Instâncias WA | `wa_instances` | ✅ `instance_id` IMUTÁVEL |
| Tokens Google | `google_calendar_tokens` | ✅ Única fonte |
| Tokens integração | `integration_configs` | ✅ Centralizado por `service_key` |
| Eventos calendário | `appointments` (internal) + `google_calendar_events` (espelho) | ⚠️ Duas tabelas — `appointments` é SOT, `google_calendar_events` é cache |
| Automações WA | `whatsapp_automation_config` + `wa_followup_rules` | ⚠️ Dois sistemas de automação distintos (templates vs follow-up) |
| Equipe comercial | `consultores` | ✅ Única fonte |
| Perfil usuário | `profiles` | ✅ Complementa `auth.users` |
| Roles | `user_roles` | ✅ Tabela separada (security best practice) |
| Planos SaaS | `plans` + `subscriptions` | ✅ |

---

## 5. Multi-Tenancy

### 5.1 Mecanismo de Isolamento

```
┌─────────────────────────────────────────────────────┐
│  CAMADA 1: COLUNA tenant_id                         │
│  - 100% das tabelas transacionais (NOT NULL)        │
│  - Default: get_user_tenant_id() ou require_tenant_id() │
│                                                      │
│  CAMADA 2: RLS POLICIES                              │
│  - TODAS as tabelas têm RLS habilitado              │
│  - Filtro: tenant_id = get_user_tenant_id()         │
│                                                      │
│  CAMADA 3: STORAGE                                   │
│  - Paths: {tenant_id}/...                            │
│  - RLS em storage.objects                            │
│                                                      │
│  CAMADA 4: EDGE FUNCTIONS                            │
│  - Propagação explícita de tenant_id em INSERTs     │
│  - service_role: resolve via config/profile         │
└─────────────────────────────────────────────────────┘
```

### 5.2 Resolução de tenant_id

| Contexto | Método | Função |
|----------|--------|--------|
| User autenticado | JWT → profile → tenant_id | `get_user_tenant_id()` |
| User autenticado (strict) | Requer profile existente | `require_tenant_id()` |
| Anônimo com código consultor | Lookup consultores | `resolve_public_tenant_id(_codigo)` |
| Anônimo sem contexto | Single active tenant | `resolve_public_tenant_id()` |
| Leads anônimos | Trigger BEFORE INSERT | `resolve_lead_tenant_id()` |
| Orçamentos anônimos | Trigger BEFORE INSERT | `resolve_orc_tenant_id()` |
| Simulações anônimas | Trigger BEFORE INSERT | `resolve_sim_tenant_id()` |

### 5.3 Riscos de Vazamento Cross-Tenant

| Risco | Severidade | Status |
|-------|-----------|--------|
| `brand_settings` SELECT público (USING true) | Baixo | Aceito (frontend filtra) |
| `obras` SELECT público | Baixo | Aceito (portfólio público) |
| `instagram_posts` SELECT público | Baixo | Aceito (posts públicos) |
| `calculadora_config` SELECT público | Nenhum | Intencional (calculadora pública) |
| `resolve_public_tenant_id()` com >1 tenant ativo | Alto | Mitigado (RAISE EXCEPTION) |
| `config_tributaria_estado.tenant_id` NULLABLE | Médio | ⚠️ Dados globais misturados com tenant-specific |

---

## 6. Automações

### 6.1 pg_cron Jobs

| Job | Schedule | Função | Risco |
|-----|----------|--------|-------|
| `cleanup-edge-rate-limits` | */15 min | Limpa `edge_rate_limits` > 1h | Baixo |
| `google-calendar-poll-10min` | */10 min | Polls Google Calendar | Médio (token expirado → retry) |
| `process-wa-followups` | */2 min | Processa fila follow-up | Alto (pode gerar spam se regra mal configurada) |
| `retry-failed-calendar-sync` | */10 min | Retry sync + reminders + auto-missed | Baixo |

### 6.2 Triggers de Banco

| Trigger | Tabela | Ação | Risco |
|---------|--------|------|-------|
| `generate_lead_code` | leads | BEFORE INSERT → gera `CLI-XXXX` | Baixo |
| `generate_orc_code` | orcamentos | BEFORE INSERT → gera `ORC-XXXX` | Baixo |
| `resolve_lead_tenant_id` | leads | BEFORE INSERT → resolve tenant | Crítico se falhar |
| `resolve_orc_tenant_id` | orcamentos | BEFORE INSERT → resolve tenant | Crítico se falhar |
| `resolve_sim_tenant_id` | simulacoes | BEFORE INSERT → resolve tenant | Baixo |
| `resolve_lead_consultor_id` | leads | BEFORE INSERT → resolve consultor fallback | Médio |
| `check_lead_rate_limit` | leads | BEFORE INSERT → rate limit | Proteção |
| `check_orcamento_rate_limit` | orcamentos | BEFORE INSERT → rate limit | Proteção |
| `check_simulacao_rate_limit` | simulacoes | BEFORE INSERT → rate limit | Proteção |
| `normalize_cliente_telefone` | clientes | BEFORE INSERT/UPDATE | Baixo |
| `generate_consultor_codigo` | consultores | BEFORE INSERT → gera código+slug | Baixo |
| `update_consultor_slug` | consultores | BEFORE UPDATE | Baixo |
| `audit_log_trigger_fn` | 14 tabelas | AFTER INSERT/UPDATE/DELETE → audit_logs | Baixo (resiliente a NULL auth) |
| `guard_audit_log_insert` | audit_logs | BEFORE INSERT → bloqueia insert direto | Proteção |
| `prevent_audit_log_update` | audit_logs | BEFORE UPDATE → bloqueia | Proteção |
| `prevent_audit_log_delete` | audit_logs | BEFORE DELETE → bloqueia | Proteção |
| `update_updated_at_column` | várias | BEFORE UPDATE → atualiza timestamp | Baixo |

### 6.3 Riscos Operacionais

| Risco | Descrição | Mitigação |
|-------|-----------|-----------|
| **Dados órfãos** | Lead sem consultor (consultor deletado) | `resolve_lead_consultor_id` com fallback para admin |
| **Follow-up conflito** | Follow-up automático + template automático para mesmo lead | ⚠️ Dois sistemas independentes — sem deduplicação explícita |
| **N+1 queries** | `process-wa-followups` pode iterar 1-by-1 | DESCONHECIDO — precisa audit do código |
| **Instância cair** | Msgs na `wa_outbox` ficam pendentes | `dead_letter_queue` + retry |
| **Webhook falhar** | `wa_webhook_events` com `retry_count` | Cleanup após 5 retries + 1 dia |

---

## 7. Integrações

### 7.1 WhatsApp (Evolution API)

| Item | Detalhe |
|------|---------|
| **Provedor** | Evolution API (self-hosted) |
| **Auth** | Secret por instância (`wa_instances.api_key`) |
| **Webhook** | `evolution-webhook` (público, valida instância) |
| **Retries** | `wa_webhook_events.retry_count` (max 5) |
| **Idempotência** | `wa_messages.remote_id` (UNIQUE por instância) |
| **Deduplicação** | Verificação `remote_id` antes de INSERT |
| **Espelho** | `wa_conversations` + `wa_messages` = fonte interna (SOT) |
| **Logs** | `wa_webhook_events`, `whatsapp_automation_logs`, `wa_health_checks` |
| **Outbox** | `wa_outbox` → `process-wa-outbox` (service_role) |

### 7.2 Google Calendar

| Item | Detalhe |
|------|---------|
| **Provedor** | Google Calendar API v3 |
| **Auth** | OAuth2 → `google_calendar_tokens` (refresh_token) |
| **Webhook** | Nenhum (polling via cron) |
| **Retries** | `agenda_sync_logs` com status `error` → retry via cron |
| **Espelho** | `google_calendar_events` (cache local) |
| **SOT** | `appointments` (fonte interna) |

### 7.3 Instagram

| Item | Detalhe |
|------|---------|
| **Provedor** | Instagram Graph API |
| **Auth** | `instagram_config.access_token` |
| **Sync** | `instagram-sync` (manual, admin) → `instagram_posts` |
| **Retries** | Nenhum (sync manual) |

### 7.4 SolarMarket

| Item | Detalhe |
|------|---------|
| **Provedor** | SolarMarket API |
| **Auth** | `SOLARMARKET_TOKEN` (secret) + `solar_market_config` |
| **Webhook** | `solar-market-webhook` (valida `x-webhook-secret`) |
| **Sync** | `solar-market-sync` (manual, admin) |
| **Tabelas** | 13 tabelas `solar_market_*` |

### 7.5 ANEEL/BCB

| Item | Detalhe |
|------|---------|
| **Provedor** | APIs públicas ANEEL e BCB |
| **Auth** | Nenhuma (públicas) |
| **Sync** | `sync-tarifas-aneel`, `sync-taxas-bcb` (manual) |

### 7.6 OpenAI

| Item | Detalhe |
|------|---------|
| **Provedor** | OpenAI API |
| **Auth** | `integration_configs` (service_key = 'openai') |
| **Funções** | `ai-suggest-message`, `ai-conversation-summary`, `ai-followup-planner`, `generate-ai-insights`, `ai-proposal-explainer` |

---

## 8. Riscos e Gaps

### 8.1 Gaps Críticos

| # | Gap | Severidade | Domínio |
|---|-----|-----------|---------|
| 1 | ⚠️ `wa_conversation_tags` SEM `tenant_id` | **ALTO** | Multi-tenancy |
| 2 | ⚠️ `wa_conversation_preferences` RLS DESCONHECIDO | **ALTO** | Segurança |
| 3 | ⚠️ `wa_message_hidden` RLS DESCONHECIDO | **ALTO** | Segurança |
| 4 | ⚠️ `wa_reads` RLS DESCONHECIDO | **ALTO** | Segurança |
| ~~5~~ | ~~`storage_migration_log` RLS DESCONHECIDO~~ | — | ✅ **RESOLVIDO** — Tabela deletada (2026-02-15) |
| 6 | ⚠️ `config_tributaria_estado.tenant_id` NULLABLE — dados globais vs tenant misturados | **MÉDIO** | Source of Truth |
| 7 | ⚠️ Dois sistemas de automação WA independentes (templates + follow-up) sem deduplicação | **MÉDIO** | Operacional |
| 8 | ⚠️ `resolve_public_tenant_id()` bloqueia com >1 tenant ativo — não escala | **ALTO** | Escalabilidade |
| 9 | ⚠️ `modulos_fotovoltaicos` vs `modulos_solares` — possível duplicidade de catálogo | **MÉDIO** | Source of Truth |
| 10 | ⚠️ `inversores` vs `inversores_catalogo` — dupla fonte para inversores | **MÉDIO** | Source of Truth |
| 11 | ⚠️ `brand_settings` SELECT público sem filtro tenant — todos os tenants visíveis | **BAIXO** | Segurança (aceito) |
| 12 | ⚠️ `backfill_audit` SEM `tenant_id` | **BAIXO** | Legacy |
| 13 | ⚠️ Tabelas push_* sem tenant_id explícito (usam user_id) | **BAIXO** | Aceitável (user-scoped) |

### 8.2 Documentação Faltante

| Item | Status |
|------|--------|
| Diagrama ER completo | ❌ Não existe |
| Mapa de webhooks recebidos (payloads) | ❌ Não existe |
| Runbook de operações (deploy, rollback) | Parcial (PHASE_02_SUMMARY) |
| Glossário de termos (consultor vs vendedor legado) | ❌ Não existe |
| Matriz de permissões por role | ❌ Não existe |
| Documentação de cada edge function (params, auth, response) | ❌ Não existe |

---

## 9. Perguntas que Faltam Responder (Priorizadas)

### P1 — Segurança (Urgente)
1. Quais são as RLS policies exatas de `wa_conversation_preferences`, `wa_message_hidden` e `wa_reads`? (`storage_migration_log` foi deletada em 2026-02-15)
2. A tabela `wa_conversation_tags` realmente não tem `tenant_id`? Se sim, qual o plano de migração?

### P2 — Escalabilidade (Importante)
3. Qual a estratégia para `resolve_public_tenant_id()` quando houver >1 tenant ativo? (Bloqueio atual).
4. O polling do Google Calendar (*/10 min para TODOS os tenants) vai escalar com 100+ tenants com Google ativo?

### P3 — Source of Truth (Importante)
5. `modulos_fotovoltaicos` e `modulos_solares` são a mesma coisa? Um deve ser deprecado?
6. `inversores` (por tenant) e `inversores_catalogo` (global?) — qual é a relação exata?
7. Os dois sistemas de automação WA (templates via `whatsapp_automation_*` e follow-ups via `wa_followup_*`) devem ser unificados ou são intencionalmente separados?

### P4 — Operacional (Média)
8. O `process-wa-followups` (cron */2min) tem proteção contra execução concorrente (duas invocações simultâneas)?
9. Existe monitoramento de `dead_letter_queue`? Alertas quando itens ficam presos?
10. Quais tabelas exatas têm o trigger `audit_log_trigger_fn` configurado? (A lista de 14 precisa confirmação.)
