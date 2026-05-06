## Unificação SSOT de Billing SaaS

Baseado na auditoria anterior, vou executar a unificação em 4 fases. Como o escopo é grande e envolve dados de produção + triggers críticos, preciso confirmar antes de começar.

### Fase 1 — Consolidar SSOT (Banco)
1. **Backfill `subscriptions`**: garantir que todo `tenant` tem 1 row em `subscriptions` espelhando `tenants.plano` (legacy text).
2. **Trigger de sync `subscriptions.status` → `tenants.status`**: quando subscription vira `suspended`/`canceled`/`expired`, marcar tenant como `suspended` (dispara `TenantSuspended` UI).
3. **Trigger reverso na UI Super Admin**: quando admin muda plano via UI antiga (`tenants.plano`), propagar para `subscriptions.plan_id`.
4. **Deprecar `tenants.plano`** como fonte: marcar como legacy via comment; `useTenantPlan` continua sendo SSOT.

### Fase 2 — Lifecycle automático
5. **Cron `expire-trials`** (pg_cron, diário às 03:00 UTC): subscriptions com `status='trialing'` e `trial_ends_at < now()` → `status='past_due'` (grace) ou `expired` se >7 dias.
6. **Cron `expire-periods`**: subscriptions `active` com `current_period_end < now()` e sem renovação Asaas → `past_due`.
7. **Cron `suspend-overdue`**: `past_due` há mais de 7 dias → `suspended`.

### Fase 3 — Webhook Asaas funcional
8. Garantir `subscriptions.external_id` é populado no momento do checkout (edge function `create-asaas-subscription`).
9. `billing-webhook-asaas` deve mapear eventos: `PAYMENT_CONFIRMED` → `active`, `PAYMENT_OVERDUE` → `past_due`, `SUBSCRIPTION_DELETED` → `canceled`.

### Fase 4 — Enforcement real
10. Plugar `enforce_limit_or_throw('max_leads_month')` no INSERT de leads (trigger DB).
11. Plugar `enforce_limit_or_throw('max_wa_messages_month')` na edge `enqueue_wa_outbox_item`.
12. Plugar `enforce_limit_or_throw('max_storage_mb')` em uploads de Storage (edge function `validate-upload`).

### Riscos
- **Suspensão automática pode bloquear tenants reais** se o backfill não popular `external_id` corretamente. Mitigação: rodar Fase 2 só **após** Fase 3 estar validada.
- **Trigger de sync bidirecional** pode criar loop. Mitigação: usar `pg_trigger_depth() = 0` como guard.
- **Asaas webhook**: se `external_id` não estiver populado em tenants atuais, eventos não casam. Mitigação: edge function de backfill manual.

### Ordem de execução proposta
Fase 1 → Fase 4 → Fase 3 → Fase 2 (deixar suspensão automática por último, já que é a mais perigosa).

### Confirmar antes de começar
Posso prosseguir com a Fase 1 (consolidação SSOT no banco) agora? É a mudança mais segura e habilita as próximas. Os crons e enforcement automático ficam para depois de você validar a Fase 1.
