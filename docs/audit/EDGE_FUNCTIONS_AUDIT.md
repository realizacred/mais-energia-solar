# EDGE FUNCTIONS AUDIT

**Data:** 2026-02-14 (atualizado 2026-02-15)  
**Total:** 50 Edge Functions (3 órfãs deletadas)

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
| ai-followup-planner | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_followup_queue |
| ai-proposal-explainer | 🔐 | 🏢 | ❌ | 🔑 | ❌ | propostas_nativas |
| ai-suggest-message | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| check-wa-instance-status | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| ~~**cleanup-legacy-storage**~~ | — | — | — | — | — | ~~storage_migration_log~~ | **DELETADA** (2026-02-15) |
| create-tenant | 🔐 | ❌ | 👤super | 🔑 | ❌ | tenants, profiles |
| create-vendedor-user | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | consultores, profiles |
| delete-user | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | profiles, user_roles |
| evolution-webhook | ❌ | 🏢 | ❌ | 🔑 | 🔄 | wa_webhook_events |
| generate-ai-insights | 🔐 | 🏢 | ❌ | 🔑 | ❌ | ai_insights |
| generate-vapid-keys | 🔐 | ❌ | ❌ | ❌ | ❌ | — |
| google-calendar-auth | 🔐 | 🏢 | ❌ | 🔑 | ❌ | google_calendar_tokens |
| google-calendar-callback | ❌ | 🏢 | ❌ | 🔑 | ❌ | google_calendar_tokens |
| google-calendar-poll | ❌ | 🏢 | ❌ | 🔑 | ❌ | appointments |
| google-calendar-read | 🔐 | 🏢 | ❌ | 🔑 | ❌ | google_calendar_events |
| google-calendar-sync | 🔐 | 🏢 | ❌ | 🔑 | ❌ | appointments |
| instagram-sync | ❌ | 🏢 | ❌ | 🔑 | ❌ | instagram_posts |
| integration-health-check | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | integration_health_cache |
| lead-scoring | 🔐 | 🏢 | ❌ | 🔑 | ❌ | lead_scores |
| list-users-emails | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | auth.users |
| ~~**loading-ai-message**~~ | — | — | — | — | — | ~~integration_configs~~ | **DELETADA** (2026-02-15) |
| ~~**migrate-storage-paths**~~ | — | — | — | — | — | ~~storage_migration_log~~ | **DELETADA** (2026-02-15) |
| process-wa-followups | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_followup_queue |
| process-wa-outbox | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_outbox |
| process-webhook-events | ❌ | 🏢 | ❌ | 🔑 | 🔄lock | wa_webhook_events |
| process-whatsapp-automations | ❌ | 🏢 | ❌ | 🔑 | ❌ | whatsapp_automation_logs |
| proposal-generate | 🔐 | 🏢 | ❌ | 🔑 | 🔄key | propostas_nativas |
| proposal-render | 🔐 | 🏢 | ❌ | 🔑 | ❌ | proposta_renders |
| public-create-lead | ❌ | 🏢 | ❌ | 🔑 | ❌ | leads |
| register-push-subscription | 🔐 | 🏢 | ❌ | ❌ | ❌ | push_subscriptions |
| resolve-wa-channel | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| retry-failed-calendar-sync | 🔐 | 🏢 | ❌ | 🔑 | ❌ | agenda_sync_logs |
| save-integration-key | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | integration_configs |
| send-push-notification | 🔐 | 🏢 | ❌ | 🔑 | ❌ | push_subscriptions |
| send-wa-reaction | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| send-wa-welcome | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_outbox |
| send-whatsapp-message | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_outbox |
| solar-market-auth | 🔐 | 🏢 | ❌ | 🔑 | ❌ | solar_market_config |
| solar-market-sync | 🔐 | 🏢 | ❌ | 🔑 | ❌ | solar_market_* |
| solar-market-webhook | ❌ | 🏢 | ❌ | 🔑 | ❌ | solar_market_webhook_events |
| super-admin-action | 🔐 | ❌ | 👤super | 🔑 | ❌ | super_admin_actions |
| sync-tarifas-aneel | ❌ | ❌ | ❌ | 🔑 | ❌ | config_tributaria_estado |
| sync-taxas-bcb | ❌ | ❌ | ❌ | 🔑 | ❌ | financiamento_bancos |
| sync-wa-history | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_messages |
| sync-wa-profile-pictures | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_conversations |
| test-evolution-connection | 🔐 | 🏢 | ❌ | 🔑 | ❌ | wa_instances |
| update-user-email | 🔐 | 🏢 | 👤admin | 🔑 | ❌ | auth.users |
| webhook-lead | ❌ | 🏢 | ❌ | 🔑 | ❌ | leads |
| writing-assistant | 🔐 | 🏢 | ❌ | 🔑 | ❌ | integration_configs |

## Findings Críticos

### ~~🔴 P0 — Funções Órfãs~~ ✅ RESOLVIDO (2026-02-15)

Todas as 3 funções órfãs foram **deletadas**:
- `cleanup-legacy-storage` — migração concluída
- `migrate-storage-paths` — migração concluída
- `loading-ai-message` — órfã com vulnerabilidade de tenant_id no payload

Tabela `storage_migration_log` também foi deletada.

### 🟡 P1 — Funções sem auth em endpoints públicos
Workers cron (process-wa-followups, process-wa-outbox, process-webhook-events) não validam JWT, o que é esperado para workers. Porém, dependem de advisory locks para idempotência — OK.

---

## Veredito
50 funções ativas. 3 órfãs deletadas em 2026-02-15 (`cleanup-legacy-storage`, `migrate-storage-paths`, `loading-ai-message`). Restante: ✅
