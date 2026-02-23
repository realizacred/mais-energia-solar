# EDGE FUNCTIONS AUDIT

**Data:** 2026-02-14 (atualizado 2026-02-23)  
**Total:** 61 Edge Functions ativas (3 órfãs deletadas em 2026-02-15, 5 consolidadas, 3 removidas)

---

## Legenda
- 🔐 Auth: Valida JWT/session
- 🏢 Tenant: Resolve tenant_id
- 👤 Role: Verifica role (admin/etc)
- 🔄 Idemp: Idempotência implementada
- 🔑 SR: Usa service_role
- ⚠️ Aceita tenant_id no payload (RISCO)

## Inventário Completo

| Função | Auth | Tenant | Role | SR | Idemp | Tabelas Principais |
|---|---|---|---|---|---|---|
| activate-vendor-account | 🔐 | 🏢 | ❌ | 🔑 | ❌ | consultores, profiles |
| admin-data-reset | 🔐 | ❌ | 👤admin | 🔑 | ❌ | TRUNCATE múltiplas |
| ai-conversation-summary | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_conversations |
| ai-followup-intelligence | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_conversations, wa_messages, wa_ai_settings |
| ai-followup-planner | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_followup_queue |
| ai-proposal-explainer | 🔐 | 🏢 | ❌ | 🔑 | ❌ | propostas_nativas |
| ai-suggest-message | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| asaas-create-charge | 🔐 | 🏢 | ❌ | ❌(anon) | 🔄exist | payment_gateway_charges, parcelas |
| asaas-test-connection | 🔐 | 🏢 | ❌ | ❌(anon) | ❌ | — (external API only) |
| asaas-webhook | ❌ | 🏢(charge) | ❌ | 🔑 | ❌ | payment_gateway_charges, parcelas, pagamentos |
| bulk-import-modules | 🔐 | 🏢 | ❌ | 🔑 | ❌ | modulos_solares |
| check-wa-instance-status | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| create-tenant | 🔐 | ❌ | 👤super | 🔑 | ❌ | tenants, profiles |
| create-vendedor-user | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | consultores, profiles |
| delete-user | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | profiles, user_roles |
| evolution-webhook | ❌ | 🏢 | ❌ | 🔑 | 🔄 | wa_webhook_events |
| extract-module-pdf | 🔐 | ❌ | ❌ | ❌ | ❌ | — (AI extraction only) |
| generate-ai-insights | 🔐 | 🏢 | ❌ | 🔑 | ❌ | ai_insights |
| generate-vapid-keys | 🔐 | ❌ | ❌ | ❌ | ❌ | — |
| get-maps-key | 🔐 | 🏢 | ❌ | 🔑 | ❌ | integration_configs |
| google-calendar-integration | 🔐 | 🏢 | ❌ | 🔑 | ❌ | integrations, integration_credentials |
| instagram-sync | ❌ | 🏢 | ❌ | 🔑 | ❌ | instagram_posts |
| integration-health-check | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | integration_health_cache |
| irradiance-import | 🔐 | ❌* | ❌ | 🔑 | 🔄ver | irradiance_dataset_versions |
| lead-scoring | 🔐 | 🏢 | ❌ | 🔑 | ❌ | lead_scores |
| list-users-emails | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | auth.users |
| nsrdb-lookup | 🔐 | ❌ | ❌ | 🔑 | 🔄cache | irradiance_lookup_cache |
| parse-conta-energia | 🔐 | ❌ | ❌ | ❌ | ❌ | — (pure parsing) |
| pipeline-automations | ❌ | 🏢(iter) | ❌ | 🔑 | ❌ | pipeline_automations, pipeline_automation_logs |
| process-sla-alerts | ❌ | 🏢(iter) | ❌ | 🔑 | ❌ | wa_sla_config, wa_sla_alerts |
| process-wa-followups | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_followup_queue |
| process-wa-outbox | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_outbox |
| process-webhook-events | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_webhook_events |
| process-whatsapp-automations | ❌ | 🏢 | ❌ | 🔑 | ❌ | whatsapp_automation_logs |
| proposal-decision-notify | ❌ | 🏢(token) | ❌ | 🔑 | ❌ | proposta_aceite_tokens |
| proposal-email | 🔐 | 🏢 | ❌ | 🔑 | ❌ | tenant_smtp_config |
| proposal-generate | 🔐 | 🏢 | ❌ | 🔑 | 🔄key | propostas_nativas |
| proposal-render | 🔐 | 🏢 | ❌ | 🔑 | ❌ | proposta_renders |
| proposal-send | 🔐 | 🏢 | ❌ | 🔑 | 🔄token | proposta_envios, proposta_aceite_tokens |
| public-create-lead | ❌ | 🏢 | ❌ | 🔑 | ❌ | leads |
| register-push-subscription | 🔐 | 🏢 | ❌ | ❌ | ❌ | push_subscriptions |
| resolve-wa-channel | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| retry-failed-calendar-sync | 🔐 | 🏢 | ❌ | 🔑 | ❌ | agenda_sync_logs |
| save-integration-key | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | integration_configs |
| send-push-notification | 🔐 | 🏢 | ❌ | 🔑 | ❌ | push_subscriptions |
| send-wa-reaction | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| send-wa-welcome | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_outbox |
| send-whatsapp-message | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_outbox |
| solar-dataset-import | 🔐 | 🏢 | ❌ | 🔑 | 🔄key | solar_import_jobs |
| super-admin-action | 🔐 | ❌ | 👤super | 🔑 | ❌ | super_admin_actions |
| sync-tarifas-aneel | ❌ | ❌ | ❌ | 🔑 | ❌ | config_tributaria_estado |
| sync-taxas-bcb | ❌ | ❌ | ❌ | 🔑 | ❌ | financiamento_bancos |
| sync-wa-history | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| sync-wa-profile-pictures | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_conversations |
| template-preview | 🔐 | 🏢 | ❌ | 🔑 | ❌ | proposta_templates |
| test-evolution-connection | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| update-user-email | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | auth.users |
| wa-health-admin | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | wa_instances, wa_outbox, wa_ops_events |
| webhook-lead | ❌ | 🏢 | ❌ | 🔑 | ❌ | leads |
| writing-assistant | 🔐 | 🏢 | ❌ | 🔑 | ❌ | integration_configs |

*irradiance-import: dados globais, sem tenant_id (esperado)

## Mudanças desde 2026-02-15

### Funções Adicionadas (19)
- `ai-followup-intelligence` — IA para follow-up inteligente
- `asaas-create-charge` — Geração de cobrança Asaas
- `asaas-test-connection` — Teste de conexão Asaas
- `asaas-webhook` — Webhook de pagamento Asaas
- `bulk-import-modules` — Importação em massa de módulos solares
- `extract-module-pdf` — Extração de dados de datasheet PDF via IA
- `get-maps-key` — Retorna chave Google Maps do tenant
- `irradiance-import` — Importação de dados de irradiância
- `nsrdb-lookup` — Consulta NSRDB para dados solares
- `parse-conta-energia` — Parser de conta de energia
- `pipeline-automations` — Automações de pipeline (cron)
- `process-sla-alerts` — Alertas SLA WhatsApp (cron)
- `proposal-decision-notify` — Notificação de aceite/recusa de proposta
- `proposal-email` — Envio de proposta por e-mail (SMTP)
- `proposal-send` — Envio de proposta (link + WhatsApp)
- `solar-dataset-import` — Importação de datasets solares
- `template-preview` — Preview de template DOCX
- `wa-health-admin` — Dashboard de saúde WhatsApp

### Funções Consolidadas
- `google-calendar-auth` → consolidada em `google-calendar-integration`
- `google-calendar-callback` → consolidada em `google-calendar-integration`
- `google-calendar-poll` → consolidada em `google-calendar-integration`
- `google-calendar-read` → consolidada em `google-calendar-integration`
- `google-calendar-sync` → consolidada em `google-calendar-integration`

### Funções Removidas
- `solar-market-auth` — integração descontinuada
- `solar-market-sync` — integração descontinuada
- `solar-market-webhook` — integração descontinuada

## Findings e Correções (2026-02-23)

### 🔴 P0 — CORRIGIDOS

#### 1. extract-module-pdf: SEM AUTENTICAÇÃO
**Antes:** Qualquer pessoa podia chamar a função e usar a LOVABLE_API_KEY para extrair PDFs.
**Correção:** Adicionada validação de JWT obrigatória.

#### 2. bulk-import-modules: Query de profile incorreta
**Antes:** `.eq("id", userData.user.id)` — campo errado, nunca encontrava o profile.
**Correção:** `.eq("user_id", userData.user.id)`

#### 3. asaas-webhook: INSERT sem tenant_id
**Antes:** Insert em `pagamentos` não incluía `tenant_id`, potencialmente falhando em RLS.
**Correção:** Adicionado `tenant_id: charge.tenant_id` no INSERT.

#### 4. wa-health-admin: Vazamento cross-tenant
**Antes:** Admin de tenant A via dados de TODOS os tenants (wa_instances, wa_outbox, wa_ops_events).
**Correção:** Todas as queries filtradas por `tenant_id` do usuário.

### 🟡 P1 — Observações (sem ação imediata)

1. **pipeline-automations**: Usa `serve()` deprecated + referencia `auto.execucoes_total` sem selecionar. Funcional mas frágil.
2. **proposal-email**: Usa `getClaims()` que pode não existir em todas as versões do SDK. Monitorar.
3. **irradiance-import**: Sem tenant — esperado para dados globais de irradiância (compartilhados).

### ~~🔴 P0 — Funções Órfãs~~ ✅ RESOLVIDO (2026-02-15)

Todas as 3 funções órfãs foram **deletadas**:
- `cleanup-legacy-storage` — migração concluída
- `migrate-storage-paths` — migração concluída
- `loading-ai-message` — órfã com vulnerabilidade de tenant_id no payload

---

## Veredito
61 funções ativas. 4 vulnerabilidades críticas corrigidas em 2026-02-23. Inventário atualizado com 19 novas funções e 8 removidas/consolidadas. ✅
