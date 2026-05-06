# Auditoria + Rearquitetura — Super Admin SaaS

## 1. Auditoria do estado atual

### 1.1 Páginas / Rotas
- Única rota: `/super-admin` → `src/pages/SuperAdmin.tsx` (93 linhas) com state local `selectedTenantId`.
- Renderiza apenas dois componentes: `SuperAdminTenantList` (386 linhas) e `SuperAdminTenantDetail` (632 linhas).
- **Não há rotas reais** (`/super-admin/billing`, `/super-admin/jobs`, etc). Tudo é state interno → impossível deep-link, voltar, abrir em nova aba.

### 1.2 SuperAdminTenantDetail — o que existe hoje
4 abas: **Visão Geral · Usuários · Integrações · Audit**.

| Capacidade | Estado |
|---|---|
| Editar nome/CNPJ/domínio | ✅ funciona |
| Editar `tenant.plano` (texto) | ⚠️ legacy — bypassa SSOT (escreve campo deprecated) |
| Trocar email do owner | ✅ via `change_owner_email` |
| Transferir ownership | ✅ |
| Reset/Set password / Ban / Delete user | ✅ |
| Toggle roles | ✅ |
| **Trocar plano via subscription** | ❌ não existe — apenas atualiza `tenants.plano` |
| **Renovar trial / extend trial_ends_at** | ❌ |
| **Forçar status (active/suspended/past_due)** | ❌ (suspend_tenant atua só em `tenants.status`) |
| **Override de feature por tenant** | ❌ tabela `tenant_feature_overrides` existe + hook `useTenantFeatureOverrides` mas não há UI |
| **Override de limite por tenant** | ❌ |
| **Visão de usage_counters** | ❌ |
| **Reprocessar webhook Asaas** | ❌ |
| **Reenviar cobrança / ver invoices** | ❌ |
| **Impersonar tenant** | ❌ |
| **Ver jobs / cron / dead-letters** | ❌ |
| **Health score consolidado** | ❌ (só lista raw `integration_health_cache`) |

### 1.3 Backend — `super-admin-action` edge function
17 ações suportadas. **Faltam**: `change_subscription_plan`, `extend_trial`, `force_subscription_status`, `set_tenant_feature_override`, `set_tenant_limit_override`, `reset_usage_counter`, `replay_webhook_event`, `impersonate_tenant`, `cancel_subscription_at_period_end`.

### 1.4 SSOT — drift detectado
- `tenants.plano` (TEXT legacy) ainda é editado pela UI → trigger `trg_sync_subscription_from_tenant_plano` propaga, mas é bidirecional e induz operador a confundir o que é canônico.
- `subscriptions` é SSOT (corrigido na fase anterior) mas **não há UI dedicada** para editar `status`, `plan_id`, `trial_ends_at`, `current_period_end` por subscription.
- `monitor_subscriptions` (assinaturas de monitoramento de usinas) coexiste com `subscriptions` (SaaS). Webhook Asaas já mantém os dois — OK, mas Super Admin não diferencia.

### 1.5 Feature governance
- `plan_features` (boolean por plano) ✅
- `tenant_feature_overrides` (override por tenant) ✅ tabela existe, sem UI
- `useFeatureAccess` resolve role→override→plan ✅
- **Gap**: nenhuma UI para listar features por tenant nem habilitar override.

### 1.6 Limits / usage
- `plan_limits` (limites por plano) ✅
- `usage_counters` ✅ + triggers `enforce_lead_quota`, `enforce_wa_quota` (fase anterior)
- `tenant_limit_overrides` → **não existe** (gap arquitetural).
- **Gap**: nenhuma UI de consumo / dashboard mensal / overage.

### 1.7 Billing operacional
- `billing-webhook-asaas` ✅ (fase anterior estendido p/ SUBSCRIPTION_*)
- `billing_webhook_events` ✅ idempotência
- `billing_charges` ✅
- `subscriptions.external_id` ✅ populado no `asaas-create-subscription`
- Cron `subscription-lifecycle-hourly` ✅
- **Gaps**: sem UI para ver charges/invoices por tenant, sem replay de webhook, sem reenviar cobrança, sem dunning state visível.

### 1.8 SaaS Health
- `integration_health_cache` ✅ por tenant
- pg_cron jobs ✅ rodando
- **Gaps**: sem painel global de jobs (quais rodaram, falharam), sem dead-letter view, sem health score consolidado por tenant.

### 1.9 Tenant isolation
- RLS ✅ na maioria das tabelas
- `super_admin` tem bypass via `has_role` ✅
- **Gap**: sem audit de impersonation (porque não existe impersonation).

---

## 2. Conflitos / drift / legado

| Item | Tipo | Ação |
|---|---|---|
| `tenants.plano` editável na UI | drift | desabilitar edição direta; obrigar via subscription |
| 4 abas estáticas no detail | UX limitada | expandir para 10 abas reais |
| State `selectedTenantId` no pai | UX | trocar por rota `/super-admin/tenants/:id/:tab` |
| Sem tabela `tenant_limit_overrides` | gap | criar |
| Sem tabela `super_admin_audit_log` dedicada | gap | já existe `audit_logs`? validar |
| `monitor_subscriptions` vs `subscriptions` | confusão | separar UIs (Billing SaaS vs Billing Monitor) |

---

## 3. Nova arquitetura proposta

### 3.1 Estrutura de rotas
```
/super-admin                          → Overview (KPIs globais)
/super-admin/tenants                  → lista
/super-admin/tenants/:id              → redirect para /overview
/super-admin/tenants/:id/overview
/super-admin/tenants/:id/billing      → subscription + charges + asaas
/super-admin/tenants/:id/usage        → counters + limits
/super-admin/tenants/:id/features     → plan + overrides
/super-admin/tenants/:id/users
/super-admin/tenants/:id/integrations
/super-admin/tenants/:id/health
/super-admin/tenants/:id/jobs
/super-admin/tenants/:id/audit
/super-admin/tenants/:id/security

/super-admin/billing                  → visão global (overdue, MRR, dunning)
/super-admin/plans                    → catálogo plans+features+limits
/super-admin/jobs                     → cron + queues + dead letters
/super-admin/webhooks                 → eventos + replay
/super-admin/audit                    → todas ações super admin
/super-admin/health                   → health score global
```

### 3.2 Camada de dados a adicionar
- `tenant_limit_overrides (tenant_id, limit_key, limit_value, expires_at, reason, created_by)`
- View `vw_tenant_health_score` (composto por billing + integrations + jobs + onboarding)
- View `vw_tenant_usage_current_month` (join usage_counters + plan_limits + overrides)
- RPC `super_admin_change_subscription(...)` — única porta para mexer em subscription
- RPC `super_admin_set_feature_override(...)`
- RPC `super_admin_set_limit_override(...)`
- RPC `super_admin_reset_usage_counter(...)`

### 3.3 Edge function `super-admin-action` — ações novas
`change_subscription_plan`, `extend_trial`, `force_subscription_status`, `cancel_at_period_end`, `set_feature_override`, `clear_feature_override`, `set_limit_override`, `reset_usage_counter`, `replay_webhook_event`, `resend_charge`, `start_impersonation` (gera magic link com escopo limitado + audit).

### 3.4 Componentização
```
src/pages/super-admin/
  SuperAdminLayout.tsx          (header + sidebar + RBAC guard)
  OverviewPage.tsx
  TenantsPage.tsx
  BillingPage.tsx
  PlansPage.tsx
  JobsPage.tsx
  WebhooksPage.tsx
  AuditPage.tsx
  HealthPage.tsx
  tenant/
    TenantLayout.tsx            (tabs horizontais — RB Memory)
    OverviewTab.tsx
    BillingTab.tsx              (subscription edit + charges + replay)
    UsageTab.tsx
    FeaturesTab.tsx
    LimitsTab.tsx
    UsersTab.tsx                (extrai do componente atual)
    IntegrationsTab.tsx
    HealthTab.tsx
    JobsTab.tsx
    AuditTab.tsx
    SecurityTab.tsx
src/hooks/super-admin/
  useSuperAdminTenant.ts
  useTenantBilling.ts
  useTenantUsage.ts
  useTenantFeatures.ts
  useTenantLimits.ts
  useSuperAdminMutations.ts
```

---

## 4. Plano de implementação faseado

Implementar em 4 PRs sequenciais para manter PRs reviewable.

### PR-1 — Fundação (estrutura + roteamento + RBAC)
- Criar `SuperAdminLayout` com sidebar e rotas reais (`react-router` nested).
- Migrar página atual (`SuperAdmin.tsx`) para usar layout + rotas.
- Manter abas atuais funcionando (zero regressão).
- Adicionar guard centralizado `useSuperAdminGuard`.

### PR-2 — Billing tab real (subscription SSOT)
- Migration: nova RPC `super_admin_change_subscription(tenant_id, plan_id?, status?, trial_ends_at?, current_period_end?, reason)`.
- Edge: ações `change_subscription_plan`, `extend_trial`, `force_subscription_status`, `cancel_at_period_end`.
- UI: aba `BillingTab` com card de subscription editável + lista de `billing_charges` + botão "replay webhook".
- Remover seletor de plano legacy do dialog "Editar Tenant" (ou marcar como readonly mostrando "use aba Billing").

### PR-3 — Features + Limits + Usage
- Migration: tabela `tenant_limit_overrides` + RLS + RPCs `super_admin_set_feature_override`, `super_admin_set_limit_override`, `super_admin_reset_usage_counter`.
- Atualizar `useFeatureAccess` para considerar override (já considera).
- Atualizar `enforce_limit_for_tenant` para considerar `tenant_limit_overrides` antes de `plan_limits`.
- UI: abas `FeaturesTab` (toggle por feature, com badge "plano"/"override") + `LimitsTab` (override de número, com expiração) + `UsageTab` (consumo do mês com barra de progresso).

### PR-4 — Health, Jobs, Webhooks, Audit globais
- Páginas globais (`/super-admin/jobs`, `/webhooks`, `/audit`, `/health`).
- View `vw_tenant_health_score`.
- Aba `HealthTab` consolidando billing+integrations+jobs.
- Replay de webhook e resend de charge.

---

## 5. Decisões pendentes (precisa do usuário)

1. **Impersonation**: aceitar magic-link de 15min com audit obrigatório? (alternativa: JWT shadow signed pelo super admin).
2. **`tenants.plano` legacy**: pode tornar **readonly** na UI já no PR-1, ou prefere deixar editável até PR-2?
3. **Sequenciamento**: posso começar pelo PR-1 (fundação + roteamento, baixo risco, zero migration) imediatamente após aprovação? Ou prefere ver primeiro o PR-2 (Billing tab) que entrega o problema visível mais imediato (plano incoerente)?
4. **Sidebar visual**: estilo Stripe (sidebar fixa esquerda, dark) ou Linear (sidebar colapsável + breadcrumbs)?

---

## 6. O que NÃO será feito

- Não criar segunda tabela de subscriptions.
- Não criar feature flags soltas fora de `plan_features` / `tenant_feature_overrides`.
- Não adicionar bypass hardcoded em código.
- Não duplicar `monitor_subscriptions` (Billing tab cobre apenas SaaS subscriptions; Monitor billing fica em página separada).
- Não fazer mock/placeholder admin — toda UI plugada em RPC real.

**Aguardo aprovação + respostas das 4 decisões para começar pelo PR-1.**