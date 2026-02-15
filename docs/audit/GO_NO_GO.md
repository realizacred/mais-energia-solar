# GO / NO-GO — Veredito Final da Auditoria

**Data:** 2026-02-14  
**Auditor:** Principal Software Architect  
**Escopo:** Frontend + Backend + Banco de Dados

---

## 🚦 VEREDITO: **CONDITIONAL GO**

O sistema pode operar com **1 tenant ativo**. Para onboarding de múltiplos tenants, as correções P0 são **obrigatórias**.

---

## 🔴 P0 — BLOQUEANTES PARA MULTI-TENANT

### P0.1 — Materialized Views sem filtro de tenant_id
**Impacto:** Cross-tenant data leak em dashboards  
**Tabelas:** mv_leads_mensal, mv_leads_por_estado, mv_consultor_performance, mv_pipeline_stats, mv_financeiro_resumo  
**Correção:**
```sql
-- Opção A: Adicionar tenant_id às MVs (requer rebuild)
-- Opção B: Substituir MVs por queries diretas com WHERE tenant_id = get_user_tenant_id()
-- Opção B é mais segura e recomendada

-- Exemplo para get_dashboard_leads_mensal:
CREATE OR REPLACE FUNCTION public.get_dashboard_leads_mensal()
RETURNS TABLE(...) AS $$
  SELECT ... FROM leads
  WHERE tenant_id = get_user_tenant_id()
    AND created_at >= now() - '1 year'::interval
  GROUP BY ...
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public';
```

### ~~P0.2 — Edge Functions Órfãs com Vulnerabilidade~~ ✅ RESOLVIDO (2026-02-15)
**Status:** Edge Functions órfãs deletadas. Tabela `storage_migration_log` removida.

---

## 🟠 P1 — IMPORTANTES

### P1.1 — `config_tributaria_estado.tenant_id` NULLABLE
**Impacto:** Dados globais ANEEL misturados com dados tenant-specific  
**Correção:**
```sql
-- Verificar se existem registros com tenant_id NULL
-- Se sim, atribuir ao tenant correto e tornar NOT NULL
ALTER TABLE config_tributaria_estado ALTER COLUMN tenant_id SET NOT NULL;
```

### P1.2 — `dominio_customizado` duplicado em `tenants` e `site_settings`
**Impacto:** Fonte de verdade ambígua para domínio personalizado  
**Correção:** Usar `tenants.dominio_customizado` como truth; remover ou deprecar em `site_settings`

### P1.3 — 68 tabelas sem índice em `tenant_id`
**Impacto:** Performance em escala (noisy neighbor)  
**Correção:** Criar índices compostos `(tenant_id, created_at)` para tabelas de alto volume:
```sql
CREATE INDEX CONCURRENTLY idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_wa_followup_queue_tenant_created ON wa_followup_queue(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_wa_outbox_tenant_created ON wa_outbox(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_wa_webhook_events_tenant_created ON wa_webhook_events(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_whatsapp_automation_logs_tenant ON whatsapp_automation_logs(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_simulacoes_tenant_created ON simulacoes(tenant_id, created_at);
CREATE INDEX CONCURRENTLY idx_lead_distribution_log_tenant ON lead_distribution_log(tenant_id, created_at);
```

### P1.4 — `storage_migration_log` + tabela órfã
**Impacto:** Tabela com 14 registros sem uso, ocupa espaço  
**Correção:** DROP TABLE após backup dos dados

---

## 🟡 P2 — MELHORIAS

### P2.1 — Componente `SiteConfigManager.tsx` órfão
**Ação:** Deletar arquivo

### P2.2 — `propostas-nativas/index.ts` barrel não usado
**Ação:** Deletar arquivo

### P2.3 — Rota `canais-captacao` sem item no menu
**Ação:** Avaliar se deve ter menu entry ou ser removida

### P2.4 — `sidebarConfig.ts` mantém dados redundantes com `navRegistry.ts`
**Ação:** Documentar que navRegistry é a fonte de verdade

---

## Resumo Executivo

| Categoria | Count | Status |
|---|---|---|
| Rotas vs Menu | 48/48 match | ✅ |
| RLS em todas as tabelas | 100% ON | ✅ |
| Tabelas multi-tenant sem tenant_id | 0 | ✅ |
| Policies públicas inseguras | 0 | ✅ |
| MVs com cross-tenant leak | 5 | 🔴 P0 |
| Edge Functions órfãs | 3 | 🔴 P0 |
| Duplicação de dados | 1 campo | 🟠 P1 |
| Tabelas sem índice tenant_id | 68 | 🟠 P1 |
| Componentes frontend órfãos | 2 | 🟡 P2 |

---

## Sequência de Correção Recomendada

1. **IMEDIATO:** Deletar 3 Edge Functions órfãs
2. **P0:** Migrar MVs para queries diretas com filtro de tenant
3. **P1:** Criar índices compostos para tabelas de alto volume
4. **P1:** Resolver `config_tributaria_estado.tenant_id` nullable
5. **P1:** Unificar `dominio_customizado` em `tenants`
6. **P2:** Limpar componentes órfãos do frontend
7. **P2:** Avaliar rota `canais-captacao`

---

*"A arquitetura está sólida. As fundações multi-tenant (RLS, tenant_id NOT NULL, SECURITY DEFINER) estão corretas. Os riscos encontrados são pontuais e corrigíveis sem refatoração estrutural."*
