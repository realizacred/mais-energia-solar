
# PR-3 — Entitlements + Limits + Usage Engine

## Auditoria (RB-76) — o que JÁ EXISTE

✅ Tabelas: `plans`, `plan_features`, `plan_limits`, `feature_flags_catalog`, `tenant_feature_overrides`, `usage_counters`, `usage_events`, `audit_feature_access_log`
✅ RPCs: `check_feature_access`, `check_tenant_limit`, `increment_usage`, `enforce_limit_or_throw`, `enforce_limit_for_tenant`, `has_feature_permission`
✅ Subscriptions canônicas (PR-2)

**Decisão (anti-gambiarra):** NÃO criar `tenant_feature_access` nem `tenant_usage_counters` (duplicariam `tenant_feature_overrides` e `usage_counters`). Vou **estender** o que já existe.

## Gaps reais a fechar

| Item | Estado | Ação |
|---|---|---|
| `expires_at` + `source` em overrides de feature | ❌ falta | ALTER TABLE `tenant_feature_overrides` |
| Tabela de overrides de **limite** | ❌ falta | CREATE `tenant_limit_overrides` |
| `consume_tenant_limit()` com lock atômico | ⚠️ check + increment separados (race) | CREATE RPC transacional com `FOR UPDATE` |
| `validate_plan_transition()` (downgrade protection) | ❌ falta | CREATE RPC |
| Grace period (`overdue_grace_until`, soft/hard lock) | ❌ falta | ALTER `subscriptions` + RPC `tenant_lock_state()` |
| Suspensão progressiva (níveis: novos→automações→IA→envio) | ❌ falta | View `tenant_enforcement_level` |
| `tenant_health_score()` | ❌ falta | CREATE RPC agregadora |
| Super Admin abas Features / Limits / Usage / Health | ❌ placeholders | Implementar com hooks reais |

## Migrações (1 só, agrupada por domínio)

```text
1. ALTER tenant_feature_overrides
   ADD source text DEFAULT 'manual' CHECK (source IN ('plan','manual','trial','addon'))
   ADD expires_at timestamptz NULL
   ADD created_by uuid NULL

2. CREATE tenant_limit_overrides (
     id, tenant_id, limit_key, limit_value,
     override_reason text, expires_at timestamptz,
     created_by uuid, created_at, updated_at,
     UNIQUE (tenant_id, limit_key)
   ) + RLS (super_admin only) + INSERT WITH CHECK tenant via JWT

3. ALTER subscriptions
   ADD overdue_since timestamptz NULL
   ADD overdue_grace_until timestamptz NULL
   ADD lock_level text DEFAULT 'none' CHECK (lock_level IN ('none','soft','hard'))

4. ALTER usage_events ensure (tenant_id, metric_key, occurred_at) index
```

## RPCs novas

```text
- consume_tenant_limit(_metric_key, _delta) → jsonb
    BEGIN; SELECT … FOR UPDATE on usage_counters row;
    resolve limit (override > plan); reject se exceder; UPSERT counter;
    INSERT usage_events; COMMIT.
- validate_plan_transition(_tenant_id, _to_plan_id) → jsonb
    para cada limit_key do destino: count uso atual > novo limite? → bloqueia
    retorna { allowed, blockers: [{metric, current, new_limit}] }
- tenant_lock_state(_tenant_id) → jsonb
    deriva { level: none|soft|hard, reason, since } a partir de
    subscription.status + overdue_grace_until + canceled_at
- tenant_health_score(_tenant_id) → jsonb
    agrega: billing(status), webhooks(últimas 24h falhas), jobs(órfãos),
    wa(instâncias desconectadas), apis(rate-limit hits), cron(últimas execuções)
    score 0–100 + breakdown
- super_admin_set_feature_override(_tenant, _key, _enabled, _source, _expires, _reason)
- super_admin_set_limit_override(_tenant, _key, _value, _expires, _reason)
- super_admin_reset_usage(_tenant, _metric_key)
```

`enforce_limit_or_throw` será atualizado para chamar `consume_tenant_limit` (compatibilidade preservada).

## Frontend — Super Admin (substitui placeholders, sem mock)

```text
src/hooks/super-admin/
  useSuperAdminFeatures.ts        — list/set overrides via RPC
  useSuperAdminLimits.ts          — list plan limits + overrides + usage
  useSuperAdminUsage.ts           — counters + events timeline
  useSuperAdminHealth.ts          — chama tenant_health_score por tenant + global

src/pages/super-admin/
  SuperAdminFeaturesPage.tsx      — global: catálogo + matriz plan×feature
  SuperAdminUsagePage.tsx         — top tenants por consumo, gráficos
  SuperAdminHealthPage.tsx        — heatmap de health por tenant

src/components/super-admin/
  SuperAdminTenantFeaturesTab.tsx — toggle + expira + source (no detail do tenant)
  SuperAdminTenantLimitsTab.tsx   — limites do plano + override + uso atual
  SuperAdminTenantUsageTab.tsx    — gráfico mensal + reset + events
  SuperAdminTenantHealthTab.tsx   — score + breakdown
```

Adicionado em `SuperAdminTenantDetail` como abas (padrão horizontal — mem rule).
Sidebar ganha entradas "Features", "Usage", "Health" (já existem placeholders, só trocar).

## Enforcement (escopo desta PR)

Esta PR entrega **engine + UI**. Substituir chamadas legadas (`increment_usage`, `enforce_limit_for_tenant`) em features premium fica para PR-4 (incremental, feature-by-feature). Aqui só atualizo `enforce_limit_or_throw` para internamente usar `consume_tenant_limit`, garantindo que **toda chamada existente já vira atômica** (sem precisar tocar 50+ arquivos).

## Suspensão progressiva — semântica

```text
lock_level=none  → tudo liberado
lock_level=soft  → bloqueia: novos recursos (criação), automações, IA
                   permite: leitura, envio crítico (WA), exports
lock_level=hard  → bloqueia tudo exceto: leitura básica + billing
```

Derivado por trigger em `subscriptions` UPDATE (status/overdue_grace_until → recalcula lock_level).

## Riscos / fora de escopo

- Não toco em features premium individuais (PR-4)
- Não removo `tenants.plano` legacy (PR-2 já fez readonly)
- Não criar mock; se RPC falha, UI mostra erro real
- Build deve passar (verificarei via tsc do harness)

## Entregáveis

1. 1 migration: 3 ALTER + 1 CREATE TABLE + 5 CREATE FUNCTION + 1 trigger
2. 4 hooks + 3 pages globais + 4 tabs no detail
3. Sidebar atualizada
4. Enforcement engine atômico (sem reescrever consumidores)
