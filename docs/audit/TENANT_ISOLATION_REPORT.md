# TENANT ISOLATION REPORT

**Data:** 2026-02-14

---

## 1. Tabelas SEM `tenant_id` (avaliação de risco)

| Tabela | Risco | Justificativa |
|---|---|---|
| `backfill_audit` | 🟢 OK | Tabela de auditoria de migração — registro técnico |
| `plan_features` | 🟢 OK | Catálogo global de features por plano — não é multi-tenant |
| `plan_limits` | 🟢 OK | Limites por plano — catálogo global |
| `plans` | 🟢 OK | Planos do SaaS — catálogo global |
| `super_admin_actions` | 🟢 OK | Tem `target_tenant_id` — ações cross-tenant por design |
| `tenants` | 🟢 OK | Tabela raiz — é o próprio tenant |

**Veredito: Nenhuma tabela multi-tenant está sem `tenant_id`.** ✅

## 2. `config_tributaria_estado.tenant_id` — NULLABLE

| Coluna | Nullable | Default |
|---|---|---|
| tenant_id | **YES** | `require_tenant_id()` |

**🟠 RISCO MÉDIO:** O campo é nullable mas o default força resolução. Dados globais (ANEEL) e dados por tenant podem estar misturados. Recomendação: tornar NOT NULL após validação de dados existentes.

## 3. Materialized Views SEM filtro de `tenant_id`

| MV | Filtra tenant_id? | Risco |
|---|---|---|
| `mv_leads_por_estado` | ❌ | 🔴 **P0 — Cross-tenant leak** |
| `mv_pipeline_stats` | ❌ | 🔴 **P0 — Cross-tenant leak** |
| `mv_financeiro_resumo` | ❌ | 🔴 **P0 — Cross-tenant leak** |
| `mv_consultor_performance` | ❌ | 🔴 **P0 — Cross-tenant leak** |
| `mv_leads_mensal` | ❌ | 🔴 **P0 — Cross-tenant leak** |

**TODAS as 5 Materialized Views agregam dados de TODOS os tenants sem filtro.** Isso significa que qualquer RPC que as consulte (`get_dashboard_leads_mensal`, `get_dashboard_pipeline`, etc.) retorna dados mesclados de todas as empresas.

### Mitigação Atual
As RPCs que servem essas MVs são `SECURITY DEFINER` mas **NÃO filtram por tenant_id** — elas simplesmente retornam `SELECT * FROM mv_*`.

### Correção Necessária (P0)
1. Adicionar `tenant_id` às MVs
2. Filtrar nas RPCs por `get_user_tenant_id()`
3. OU: Substituir MVs por queries diretas com filtro de tenant

## 4. Tabelas com `tenant_id` mas SEM índice em `tenant_id`

**68 tabelas** não possuem índice explícito em `tenant_id`. Muitas usam FK para `tenants(id)` que cria um índice implícito, mas tabelas de alto volume precisam de índice composto `(tenant_id, created_at)`.

### Tabelas prioritárias para indexação:
- `audit_logs` (alto volume)
- `wa_followup_queue` (alto volume)  
- `wa_outbox` (alto volume)
- `wa_webhook_events` (alto volume)
- `whatsapp_automation_logs` (alto volume)
- `lead_distribution_log` (alto volume)
- `simulacoes` (alto volume)

## 5. Policies com `USING true` (SELECT público)

| Tabela | Policy | Roles | Risco |
|---|---|---|---|
| brand_settings | select_public | anon,auth | 🟢 Intencional — visual da marca |
| config_tributaria_estado | select_public | anon,auth | 🟢 Intencional — dados ANEEL |
| fio_b_escalonamento | select_public | anon,auth | 🟢 Intencional — dados técnicos |
| instagram_posts | select_public | anon,auth | 🟢 Intencional — feed público |
| irradiacao_por_estado | visível para todos | public | 🟢 Intencional — dados de irradiação |
| payback_config | select_public | anon,auth | 🟢 Intencional — calc. pública |
| site_settings | Public read | public | 🟢 Intencional — dados do site |
| site_servicos | select_public | anon,auth | 🟢 Intencional — serviços do site |
| plans | select_authenticated | auth | 🟢 OK — catálogo de planos |

**⚠️ TODAS são intencionais e documentadas.** Nenhuma expõe dados sensíveis.

## ~~6. `storage_migration_log` — Tabela Órfã~~ ✅ RESOLVIDO (2026-02-15)

Tabela `storage_migration_log` e Edge Functions órfãs (`migrate-storage-paths`, `cleanup-legacy-storage`, `loading-ai-message`) foram **deletadas**. Relatórios de migração removidos da documentação.

---

## Veredito

🔴 **NO-GO parcial:** As 5 Materialized Views são um risco P0 de cross-tenant data leak. Correção obrigatória antes de onboarding de novos tenants.
