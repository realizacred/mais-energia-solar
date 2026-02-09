# SaaS Billing Core — Fase SaaS-1

## Visão Geral

Sistema de controle de planos, assinaturas e limites por tenant. **Sem integração de pagamento** — apenas enforcement de limites e preparação para futuro Stripe.

## Tabelas

| Tabela | Descrição |
|---|---|
| `plans` | Catálogo de planos (FREE, STARTER, PRO, ENTERPRISE) |
| `plan_features` | Features booleanas por plano (ex: `whatsapp_automation`) |
| `plan_limits` | Limites numéricos por plano (ex: `max_users = 5`) |
| `subscriptions` | Assinatura ativa de cada tenant (status, trial, período) |
| `usage_counters` | Contadores de uso mensal por tenant |
| `usage_events` | Log de auditoria de eventos de uso |

## Planos e Limites

| Limite | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| `max_users` | 2 | 5 | 15 | 50 |
| `max_leads_month` | 50 | 300 | 1.000 | 10.000 |
| `max_wa_messages_month` | 0 | 500 | 3.000 | 20.000 |
| `max_automations` | 0 | 5 | 20 | 100 |
| `max_storage_mb` | 100 | 1.000 | 5.000 | 50.000 |
| `max_proposals_month` | 10 | 50 | 200 | 5.000 |

## Features por Plano

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---|---|---|---|---|
| `whatsapp_automation` | ❌ | ✅ | ✅ | ✅ |
| `ai_insights` | ❌ | ❌ | ✅ | ✅ |
| `advanced_reports` | ❌ | ❌ | ✅ | ✅ |
| `gamification` | ❌ | ✅ | ✅ | ✅ |
| `solar_market` | ❌ | ✅ | ✅ | ✅ |
| `multi_instance_wa` | ❌ | ❌ | ✅ | ✅ |
| `api_access` | ❌ | ❌ | ✅ | ✅ |
| `white_label` | ❌ | ❌ | ❌ | ✅ |

## Preços

| Plano | Mensal | Anual |
|---|---|---|
| FREE | R$ 0 | R$ 0 |
| STARTER | R$ 197 | R$ 1.970 |
| PRO | R$ 497 | R$ 4.970 |
| ENTERPRISE | R$ 997 | R$ 9.970 |

## RPC Functions

### `get_tenant_subscription()`
Retorna subscription + plan do tenant do usuário autenticado.

### `check_tenant_limit(metric_key, delta)`
Verifica se o tenant pode consumir mais `delta` unidades de `metric_key`. Retorna `{allowed, current_value, limit_value, remaining}`.

### `increment_usage(metric_key, delta, source)`
Incrementa o contador de uso e registra evento de auditoria.

### `enforce_limit_or_throw(metric_key, delta)`
Verifica limite e lança erro `P0450` se excedido. Uso em triggers/functions server-side.

## Como Ativar Trial

Ao criar um tenant, a migration insere automaticamente uma subscription com:
- `status = 'trialing'`
- `trial_ends_at = now() + 14 days`
- `plan_id = FREE`

Para novos tenants futuros, inserir manualmente:
```sql
INSERT INTO subscriptions (tenant_id, plan_id, status, trial_ends_at)
SELECT 'TENANT_UUID', id, 'trialing', now() + interval '14 days'
FROM plans WHERE code = 'free';
```

## Como Mudar Plano Manualmente

```sql
UPDATE subscriptions
SET plan_id = (SELECT id FROM plans WHERE code = 'pro'),
    status = 'active',
    trial_ends_at = NULL,
    current_period_start = now(),
    current_period_end = now() + interval '30 days'
WHERE tenant_id = 'TENANT_UUID';
```

## Integração no App

### Hook `useTenantPlan()`
```tsx
const {
  subscription,      // dados da subscription
  features,          // Record<string, boolean>
  limits,            // Record<string, number>
  isTrialing,        // boolean
  trialDaysRemaining, // number
  hasFeature,        // (key) => boolean
  checkLimit,        // (key, delta) => Promise<LimitCheckResult>
  incrementUsage,    // (key, delta, source) => Promise<void>
  enforceLimit,      // (key, delta) => Promise (throws PlanLimitError)
} = useTenantPlan();
```

### Guard `usePlanGuard()`
```tsx
const { guardLimit, LimitDialog } = usePlanGuard();

const handleCreate = async () => {
  const ok = await guardLimit("max_users");
  if (!ok) return; // dialog shown automatically
  // proceed
};

return <>{LimitDialog}</>;
```

### Pontos de Enforcement

| Ação | Metric Key | Onde |
|---|---|---|
| Criar usuário | `max_users` | `UsuariosManager.handleCreateUser` |
| Criar lead | `max_leads_month` | A implementar |
| Enviar WhatsApp | `max_wa_messages_month` | A implementar em edge function |
| Criar automação | `max_automations` | A implementar |
| Upload storage | `max_storage_mb` | A implementar |

## Checklist de Testes

- [ ] Verificar seed: 4 planos criados com features e limits
- [ ] Verificar subscription trial criada para tenant existente
- [ ] `get_tenant_subscription()` retorna dados corretos
- [ ] `check_tenant_limit('max_users', 1)` retorna `{allowed: true/false}`
- [ ] `increment_usage('max_users', 1, 'user_create')` incrementa counter
- [ ] `enforce_limit_or_throw` lança erro P0450 quando excede
- [ ] TrialBanner aparece no admin quando status = trialing
- [ ] LimitReachedDialog aparece ao tentar criar usuário além do limite
- [ ] RLS: usuário não vê subscription de outro tenant
- [ ] RLS: super_admin pode gerenciar plans e subscriptions

## Preparação para Stripe

A tabela `subscriptions` já possui:
- `external_id TEXT` — para Stripe Subscription ID
- `status` enum compatível com Stripe lifecycle
- `cancel_at_period_end` — para cancelamento no fim do período

Quando integrar Stripe:
1. Criar webhook endpoint para eventos Stripe
2. Mapear `customer.subscription.*` events para atualizar `subscriptions`
3. Adicionar `stripe_customer_id` na tabela `tenants`
4. Criar checkout session linkando ao `plan.code`
