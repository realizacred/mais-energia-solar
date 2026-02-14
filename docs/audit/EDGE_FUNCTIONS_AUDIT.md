# EDGE FUNCTIONS AUDIT

**Data:** 2026-02-14  
**Total:** 53 Edge Functions

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
| **cleanup-legacy-storage** | ❌ | ❌ | ❌ | 🔑 | ❌ | storage_migration_log |
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
| **loading-ai-message** | ❌ | ⚠️ | ❌ | 🔑 | ❌ | integration_configs |
| **migrate-storage-paths** | ❌ | ❌ | ❌ | 🔑 | ❌ | storage_migration_log |
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

### 🔴 P0 — `loading-ai-message` aceita `tenant_id` no payload
```json
{ "context": "...", "tenant_id": "..." }
```
O campo `tenant_id` é enviado pelo frontend, permitindo que um usuário passe o tenant_id de outro tenant e acesse suas chaves OpenAI.

**Mitigação:** Função órfã — 0 imports no frontend. **DELETAR.**

### 🔴 P0 — Funções Órfãs (sem referência no frontend)
| Função | Motivo |
|---|---|
| `cleanup-legacy-storage` | Migração concluída |
| `migrate-storage-paths` | Migração concluída |
| `loading-ai-message` | 0 imports + aceita tenant_id |

**Ação:** Deletar todas.

### 🟡 P1 — Funções sem auth em endpoints públicos
Workers cron (process-wa-followups, process-wa-outbox, process-webhook-events) não validam JWT, o que é esperado para workers. Porém, dependem de advisory locks para idempotência — OK.

---

## Veredito
53 funções, 3 órfãs (DELETAR), 1 com vulnerabilidade de tenant_id no payload (DELETAR). Restante: ✅
