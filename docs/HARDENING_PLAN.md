# 🔒 PLANO DE HARDENING — SaaS Enterprise

**Data:** 2026-02-09  
**Última atualização:** 2026-02-09  
**Status:** EM EXECUÇÃO  
**Filosofia:** Engenharia incremental, sem reescrita destrutiva

---

## HISTÓRICO DE EXECUÇÃO

| Fase | Status | Data | Migration IDs | Notas |
|------|--------|------|---------------|-------|
| **0.1 — Fix tenant_id defaults** | ✅ CONCLUÍDA | 2026-02-09 03:48 UTC | `20260209034857` | 57 tabelas: default alterado de hardcoded para `get_user_tenant_id()`. |
| **0.1.1-A — Backfill tenant_id NULL** | ✅ CONCLUÍDA | 2026-02-09 03:56 UTC | `20260209035619` + `20260209035905` | **157 registros** backfilled com auditoria completa. Tabela `backfill_audit` criada. Detalhes: wa_webhook_events (76), wa_messages (28), wa_quick_replies (17), wa_outbox (13), wa_tags (5), wa_transfers (4), site_servicos (4), solar_market_sync_logs (3), wa_conversations (3), wa_instances (1), inversores (1), baterias (1), modulos_fotovoltaicos (1). **Zero órfãos**. |
| **0.1.1-B — Hardening funções tenant** | ✅ CONCLUÍDA | 2026-02-09 03:57 UTC | `20260209035758` | `get_user_tenant_id()` sem fallback (retorna NULL). Nova `require_tenant_id()` com RAISE EXCEPTION. 97 tabelas reclassificadas: ~35 com `require_tenant_id()`, ~45 com `get_user_tenant_id()`, 2 sem default. |
| 0.2 — Reescrever RLS policies | ⏳ Pendente | — | — | — |
| 1.0 — JWT em Edge Functions | ⏳ Pendente | — | — |

---

## SUMÁRIO EXECUTIVO

| Métrica | Valor |
|---------|-------|
| Total de tabelas `public` | 97 |
| Tabelas com `tenant_id` | 92 |
| Tabelas com default CORRETO (`get_user_tenant_id()`) | 42 |
| Tabelas com default HARDCODED (`'0000...0001'`) | 33 |
| Tabelas com default NULL/ausente | 17 |
| RLS policies com filtro `tenant_id` | ~8 |
| RLS policies SEM filtro `tenant_id` | ~85+ |
| Edge Functions sem JWT | 18/18 |
| Tabelas WhatsApp duplicadas | 10 `whatsapp_*` + 11 `wa_*` |
| Campos `vendedor` TEXT ativos | 2 (leads, orcamentos) |

**Veredicto:** O sistema tem uma base sólida (tenant_id existe em 95% das tabelas), mas o isolamento real está **QUEBRADO** — um admin de qualquer tenant pode ver dados de todos os outros.

---

## 🔴 FASE 0 — ISOLAMENTO MULTI-TENANT (BLOQUEADOR ABSOLUTO)

### 0.1 — Corrigir defaults hardcoded de `tenant_id`

**Risco:** 🔴 CRÍTICO — Novos registros ficam atribuídos ao tenant errado  
**Impacto:** Alto — Afeta 33 tabelas  
**Dificuldade:** Baixa — ALTER TABLE simples  
**Rollback:** `ALTER TABLE ... ALTER COLUMN tenant_id SET DEFAULT '<valor_antigo>';`

**Tabelas afetadas (33):**

| # | Tabela | Default atual |
|---|--------|---------------|
| 1 | `config_tributaria_estado` | `'0000...0001'::uuid` |
| 2 | `financiamento_bancos` | `'0000...0001'::uuid` |
| 3 | `fio_b_escalonamento` | `'0000...0001'::uuid` |
| 4 | `gamification_config` | `'0000...0001'::uuid` |
| 5 | `instagram_config` | `'0000...0001'::uuid` |
| 6 | `instagram_posts` | `'0000...0001'::uuid` |
| 7 | `instalador_config` | `'0000...0001'::uuid` |
| 8 | `instalador_metas` | `'0000...0001'::uuid` |
| 9 | `instalador_performance_mensal` | `'0000...0001'::uuid` |
| 10 | `layouts_solares` | `'0000...0001'::uuid` |
| 11 | `lead_scoring_config` | `'0000...0001'::uuid` |
| 12 | `lead_status` | `'0000...0001'::uuid` |
| 13 | `meta_notifications` | `'0000...0001'::uuid` |
| 14 | `obras` | `'0000...0001'::uuid` |
| 15 | `pagamentos_comissao` | `'0000...0001'::uuid` |
| 16 | `payback_config` | `'0000...0001'::uuid` |
| 17 | `release_checklists` | `'0000...0001'::uuid` |
| 18 | `sla_rules` | `'0000...0001'::uuid` |
| 19 | `task_events` | `'0000...0001'::uuid` |
| 20 | `tasks` | `'0000...0001'::uuid` |
| 21 | `user_roles` | `'0000...0001'::uuid` |
| 22 | `vendedor_metricas` | `'0000...0001'::uuid` |
| 23 | `vendedor_performance_mensal` | `'0000...0001'::uuid` |
| 24 | `webhook_config` | `'0000...0001'::uuid` |
| 25 | `whatsapp_automation_config` | `'0000...0001'::uuid` |
| 26 | `whatsapp_automation_logs` | `'0000...0001'::uuid` |
| 27 | `whatsapp_automation_templates` | `'0000...0001'::uuid` |
| 28 | `whatsapp_conversation_messages` | `'0000...0001'::uuid` |
| 29 | `whatsapp_conversations` | `'0000...0001'::uuid` |
| 30 | `whatsapp_messages` | `'0000...0001'::uuid` |
| 31 | `whatsapp_reminders` | `'0000...0001'::uuid` |
| 32 | `whatsapp_tags` | `'0000...0001'::uuid` |
| 33 | `whatsapp_transfers` | `'0000...0001'::uuid` |

**Script SQL (Migration 0.1):**

```sql
-- BATCH 1: Configurações
ALTER TABLE config_tributaria_estado ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE financiamento_bancos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE fio_b_escalonamento ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE gamification_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instagram_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instagram_posts ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_metas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE instalador_performance_mensal ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE lead_scoring_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE lead_status ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE payback_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE sla_rules ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE webhook_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- BATCH 2: Operacionais
ALTER TABLE layouts_solares ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE meta_notifications ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE obras ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE pagamentos_comissao ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE release_checklists ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE task_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE tasks ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE user_roles ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE vendedor_metricas ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE vendedor_performance_mensal ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- BATCH 3: WhatsApp legado
ALTER TABLE whatsapp_automation_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_automation_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_automation_templates ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversation_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_conversations ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_messages ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_reminders ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE whatsapp_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
```

### 0.2 — Corrigir tabelas sem default de `tenant_id`

**Risco:** 🔴 CRÍTICO — Registros criados sem tenant ficam "órfãos"  
**Impacto:** Alto — Afeta 17 tabelas  
**Dificuldade:** Baixa  

**Tabelas afetadas (17):**

| # | Tabela | is_nullable |
|---|--------|-------------|
| 1 | `lead_links` | YES |
| 2 | `proposal_variables` | YES |
| 3 | `site_banners` | **NO** |
| 4 | `site_servicos` | YES |
| 5 | `site_settings` | **NO** |
| 6 | `solar_market_clients` | YES |
| 7 | `solar_market_config` | YES |
| 8 | `solar_market_custom_fields` | YES |
| 9 | `solar_market_custom_fields_catalog` | YES |
| 10 | `solar_market_funnels` | YES |
| 11 | `solar_market_funnels_catalog` | YES |
| 12 | `solar_market_integration_requests` | YES |
| 13 | `solar_market_projects` | YES |
| 14 | `solar_market_proposals` | YES |
| 15 | `solar_market_sync_items_failed` | YES |
| 16 | `solar_market_sync_logs` | YES |
| 17 | `solar_market_users` | YES |
| 18 | `solar_market_webhook_events` | YES |
| 19 | `wa_outbox` | YES |
| 20 | `wa_quick_replies` | YES |
| 21 | `wa_satisfaction_ratings` | YES |
| 22 | `wa_tags` | YES |
| 23 | `wa_transfers` | YES |
| 24 | `wa_webhook_events` | YES |
| 25 | `wa_conversation_tags` | YES |

**Script SQL (Migration 0.2):**

```sql
-- Tabelas sem default (adicionar get_user_tenant_id())
ALTER TABLE lead_links ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE proposal_variables ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE site_servicos ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_clients ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_config ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_custom_fields_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_funnels_catalog ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_integration_requests ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_projects ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_proposals ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_items_failed ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_sync_logs ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_users ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE solar_market_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_outbox ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_quick_replies ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_satisfaction_ratings ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_transfers ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_webhook_events ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
ALTER TABLE wa_conversation_tags ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();
```

### 0.3 — Reescrever TODAS as RLS policies com filtro `tenant_id`

**Risco:** 🔴 CRÍTICO — Admin do Tenant A vê TODOS os dados de TODOS os tenants  
**Impacto:** Catastrófico — Vazamento total de dados  
**Dificuldade:** Média — Muitas policies, mas padrão repetitivo  
**Rollback:** Script de restauração das policies antigas

**Diagnóstico:** Atualmente, ~85% das policies usam apenas `is_admin(auth.uid())` sem verificar `tenant_id`. Isso significa que qualquer admin vê dados de todos os tenants.

**Novo padrão obrigatório para TODA policy:**

```sql
-- Para admin: tenant_id deve ser do tenant do admin
CREATE POLICY "nome" ON tabela FOR cmd
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Para vendedores: tenant via relacionamento
CREATE POLICY "nome" ON tabela FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND vendedor_id IN (
    SELECT id FROM vendedores WHERE user_id = auth.uid()
  ));

-- Para dados públicos do site: filtrar por tenant (sem auth)
CREATE POLICY "nome" ON tabela FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND ativo = true);
```

**Tabelas que precisam de reescrita de policies (lista completa):**

> ⚠️ CADA tabela abaixo precisa de DROP POLICY + CREATE POLICY com `tenant_id = get_user_tenant_id()` adicionado

| Grupo | Tabelas |
|-------|---------|
| **Equipamentos** | `baterias`, `inversores`, `modulos_fotovoltaicos`, `disjuntores`, `transformadores` |
| **Configuração** | `calculadora_config`, `payback_config`, `financiamento_bancos`, `financiamento_api_config`, `gamification_config`, `instagram_config`, `instalador_config`, `lead_scoring_config`, `lead_status`, `webhook_config`, `sla_rules` |
| **CRM Core** | `leads`, `orcamentos`, `clientes`, `projetos`, `propostas`, `proposta_itens`, `proposta_variaveis`, `proposal_variables`, `comissoes`, `pagamentos`, `pagamentos_comissao`, `parcelas`, `recebimentos` |
| **Operacional** | `servicos_agendados`, `obras`, `checklist_*` (8 tabelas), `checklists_*` (3 tabelas) |
| **Vendedores** | `vendedores`, `vendedor_metas`, `vendedor_metricas`, `vendedor_achievements`, `vendedor_performance_mensal`, `meta_notifications` |
| **Instaladores** | `instalador_metas`, `instalador_performance_mensal`, `layouts_solares` |
| **WhatsApp** | Todas `wa_*` (11) e `whatsapp_*` (10) |
| **SolarMarket** | Todas `solar_market_*` (12) |
| **Site** | `site_banners`, `site_servicos`, `site_settings`, `brand_settings` |
| **Sistema** | `tasks`, `task_events`, `user_roles`, `profiles`, `audit_logs`, `ai_insights`, `simulacoes`, `lead_atividades`, `lead_scores`, `release_checklists`, `instagram_posts` |

**Exemplo de reescrita (padrão a seguir para cada tabela):**

```sql
-- ANTES (INSEGURO):
DROP POLICY IF EXISTS "Admins can manage leads" ON leads;
DROP POLICY IF EXISTS "Vendedores can read their leads" ON leads;

-- DEPOIS (SEGURO):
CREATE POLICY "Admins can manage leads" ON leads FOR ALL
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "Vendedores can read their leads" ON leads FOR SELECT
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor IN (
      SELECT nome FROM vendedores 
      WHERE user_id = auth.uid() AND tenant_id = get_user_tenant_id()
    )
  );
```

**⚠️ Casos especiais que NÃO devem filtrar por tenant_id do usuário:**

1. **`simulacoes`** — INSERT público (anon): usar `tenant_id` passado pelo frontend ou inferir do contexto
2. **`leads`** — INSERT público (anon): idem
3. **`orcamentos`** — INSERT público (anon): idem  
4. **Dados públicos do site** (`site_banners`, `site_settings`, `brand_settings`, `obras`, `instagram_posts`, `site_servicos`) — SELECT público: filtrar por `tenant_id` passado na query, não por `get_user_tenant_id()` que requer auth
5. **`config_tributaria_estado`**, `fio_b_escalonamento` — Dados compartilhados entre tenants (regulatórios)

### 0.4 — Isolamento de Storage Buckets

**Risco:** 🟠 Alto — Arquivos de um tenant podem ser acessados por outro  
**Impacto:** Médio  
**Dificuldade:** Média  

**Estado atual:**
- 8 buckets existentes sem path isolation
- Nenhuma policy verifica tenant_id no path

**Plano:**
1. Estrutura de path obrigatória: `{tenant_id}/{user_id_ou_record_id}/{arquivo}`
2. Reescrever policies de storage:

```sql
-- Exemplo para bucket 'documentos-clientes'
CREATE POLICY "Tenant isolation for docs"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documentos-clientes'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'documentos-clientes'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);
```

3. **Migração de arquivos existentes:** Script para mover arquivos existentes para a nova estrutura

### 0.5 — Isolamento em Edge Functions

**Risco:** 🔴 CRÍTICO — Edge functions usam `service_role` sem filtrar tenant  
**Impacto:** Alto  
**Dificuldade:** Média  

**Functions que precisam de tenant guard (18 total):**

| Function | Usa service_role? | Filtra tenant? | Risco |
|----------|-------------------|----------------|-------|
| `create-vendedor-user` | ✅ | ❌ | 🔴 |
| `delete-user` | ✅ | ❌ | 🔴 |
| `generate-ai-insights` | ✅ | ❌ | 🔴 |
| `instagram-sync` | ✅ | ❌ | 🔴 |
| `lead-scoring` | ✅ | ❌ | 🟠 |
| `list-users-emails` | ✅ | ❌ | 🔴 |
| `process-wa-outbox` | ✅ | ❌ | 🔴 |
| `process-webhook-events` | ✅ | ❌ | 🔴 |
| `process-whatsapp-automations` | ✅ | ❌ | 🔴 |
| `send-whatsapp-message` | ✅ | ❌ | 🔴 |
| `solar-market-sync` | ✅ | ❌ | 🟠 |
| `solar-market-webhook` | ✅ | ❌ | 🟠 |
| `solar-market-auth` | ✅ | ❌ | 🟠 |
| `sync-tarifas-aneel` | ✅ | ❌ | 🟡 |
| `sync-taxas-bcb` | ✅ | ❌ | 🟡 |
| `test-evolution-connection` | ✅ | ❌ | 🟠 |
| `evolution-webhook` | ✅ | ✅ (parcial) | 🟠 |
| `webhook-lead` | ❌ | ❌ | 🟡 |
| `check-wa-instance-status` | ✅ | ❌ | 🟠 |

**Padrão obrigatório para TODA edge function:**

```typescript
// 1. Extrair tenant_id do JWT do usuário autenticado
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('tenant_id')
  .eq('user_id', user.id)
  .single();
const tenantId = profile.tenant_id;

// 2. Filtrar TODAS as queries por tenant_id
const { data } = await supabaseAdmin
  .from('tabela')
  .select('*')
  .eq('tenant_id', tenantId);
```

---

## 🔴 FASE 1 — HARDENING DE SEGURANÇA

### 1.1 — Ativar JWT em Edge Functions

**Risco:** 🔴 CRÍTICO — Qualquer pessoa pode chamar qualquer function  
**Impacto:** Alto  
**Dificuldade:** Média  

**Estado atual:** Todas 18 functions com `verify_jwt = false`

**Plano:**
- Manter `verify_jwt = false` no config (necessário para CORS preflight)
- Implementar validação JWT **no código** de cada function usando `getClaims()`
- Functions que DEVEM aceitar chamadas públicas (webhooks):
  - `evolution-webhook` — validar via `webhook_secret`
  - `solar-market-webhook` — validar via token/signature
  - `webhook-lead` — validar via secret header

**Padrão de autenticação:**

```typescript
// Para functions autenticadas
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
const token = authHeader.replace('Bearer ', '');
const { data, error } = await supabase.auth.getClaims(token);
if (error) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
const userId = data.claims.sub;

// Para webhooks públicos
const webhookSecret = req.headers.get('X-Webhook-Secret');
if (webhookSecret !== Deno.env.get('WEBHOOK_SECRET')) {
  return new Response('Forbidden', { status: 403 });
}
```

### 1.2 — Rate Limiting

**Risco:** 🟠 Alto — Sem proteção contra abuso  
**Impacto:** Médio  
**Dificuldade:** Média  

**Estado atual:**
- ✅ `check_lead_rate_limit` (5/hora por telefone) — OK
- ✅ `check_simulacao_rate_limit` (50/5min global) — OK
- ✅ `check_orcamento_rate_limit` (10/hora por lead) — OK
- ❌ Nenhum rate limit em edge functions
- ❌ Nenhum rate limit em APIs de admin

**Plano:**

```sql
-- Tabela de rate limiting genérica
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL, -- ex: 'ef:send-whatsapp:tenant123'
  count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key)
);

-- Function de rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  _key TEXT, _max_count INT, _window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_count INT;
BEGIN
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < now() - (_window_seconds || ' seconds')::interval
      THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < now() - (_window_seconds || ' seconds')::interval
      THEN now()
      ELSE rate_limits.window_start
    END
  RETURNING count INTO current_count;
  
  RETURN current_count <= _max_count;
END;
$$;
```

### 1.3 — Idempotência para Webhooks

**Risco:** 🟠 Alto — Webhooks duplicados causam dados corrompidos  
**Impacto:** Médio  
**Dificuldade:** Baixa  

**Plano:**
- `wa_webhook_events` já tem campo `processed` — ✅ parcialmente ok
- Adicionar `idempotency_key` em tabelas de webhook:

```sql
ALTER TABLE wa_webhook_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE solar_market_webhook_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
```

### 1.4 — Retry com Backoff

**Risco:** 🟡 Médio  
**Impacto:** Médio  
**Dificuldade:** Baixa  

**Estado atual:**
- `wa_webhook_events` tem `retry_count` — ✅ parcialmente ok
- `wa_outbox` não tem retry — ❌

**Plano:**

```sql
ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE wa_outbox ADD COLUMN IF NOT EXISTS last_error TEXT;
```

---

## 🟠 FASE 2 — SEGREDOS E CREDENCIAIS

### 2.1 — Migrar tokens de tabelas para Vault/Secrets

**Risco:** 🔴 CRÍTICO — Tokens em plain text no banco  
**Impacto:** Alto — Qualquer admin com acesso ao SQL Editor vê tokens de outros  
**Dificuldade:** Média  

**Tokens atualmente em tabelas:**

| Tabela | Campo | Conteúdo |
|--------|-------|----------|
| `solar_market_config` | `api_token` | Token SolarMarket |
| `solar_market_config` | `last_token` | Bearer token cacheado |
| `instagram_config` | `access_token` | Token Instagram Graph API |
| `wa_instances` | `api_key` | Chave Evolution API |
| `wa_instances` | `webhook_secret` | Secret do webhook |
| `financiamento_api_config` | `api_key` | Chave API financeira |

**Plano de migração:**

1. **Curto prazo:** Mover para Supabase Secrets (edge functions)
   - Cada tenant terá secrets nomeados: `TENANT_{id}_SM_TOKEN`, `TENANT_{id}_EVOLUTION_KEY`, etc.
   - Edge functions buscam o secret correto baseado no tenant_id

2. **Médio prazo:** Criar tabela `tenant_secrets` com criptografia:

```sql
-- Os valores NUNCA são retornados ao frontend
CREATE TABLE tenant_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  secret_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL, -- criptografado via pgcrypto
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, secret_name)
);

-- RLS: NUNCA expor valores
ALTER TABLE tenant_secrets ENABLE ROW LEVEL SECURITY;

-- Apenas service_role pode ler (via edge functions)
CREATE POLICY "Service role only" ON tenant_secrets
FOR ALL USING (false); -- Bloqueia todo acesso via client

-- Function segura para edge functions
CREATE OR REPLACE FUNCTION get_tenant_secret(_tenant_id UUID, _name TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _value TEXT;
BEGIN
  SELECT pgp_sym_decrypt(encrypted_value::bytea, current_setting('app.encryption_key'))
  INTO _value
  FROM tenant_secrets
  WHERE tenant_id = _tenant_id AND secret_name = _name;
  RETURN _value;
END;
$$;
```

3. **Remover campos de token das tabelas originais** após migração completa

---

## 🟠 FASE 3 — CONSOLIDAÇÃO DE DADOS DUPLICADOS

### 3.1 — Unificar `whatsapp_*` e `wa_*`

**Risco:** 🟠 Alto — Duplicação causa inconsistência  
**Impacto:** Alto  
**Dificuldade:** Alta — Requer migração de dados + refatoração de código  

**Mapeamento de equivalências:**

| `whatsapp_*` (LEGADO) | `wa_*` (ATUAL) | Ação |
|------------------------|----------------|------|
| `whatsapp_conversations` | `wa_conversations` | Migrar dados → `wa_conversations` |
| `whatsapp_messages` | `wa_messages` | Migrar dados → `wa_messages` |
| `whatsapp_conversation_messages` | (sem equivalente direto) | Avaliar se dados são relevantes |
| `whatsapp_tags` | `wa_tags` | Migrar dados → `wa_tags` |
| `whatsapp_conversation_tags` | `wa_conversation_tags` | Migrar dados → `wa_conversation_tags` |
| `whatsapp_transfers` | `wa_transfers` | Migrar dados → `wa_transfers` |
| `whatsapp_automation_config` | (manter separado) | Apenas corrigir tenant_id |
| `whatsapp_automation_logs` | (manter separado) | Apenas corrigir tenant_id |
| `whatsapp_automation_templates` | (manter separado) | Apenas corrigir tenant_id |
| `whatsapp_reminders` | (sem equivalente) | Avaliar necessidade |

**Plano de migração (em 3 etapas):**

```
Etapa A: Copiar dados de whatsapp_* → wa_* (INSERT ... SELECT ...)
Etapa B: Atualizar código frontend para usar apenas wa_*
Etapa C: Marcar whatsapp_* como deprecated (não deletar imediatamente)
Etapa D (futuro): DROP TABLE whatsapp_* após período de validação
```

### 3.2 — Eliminar campo `vendedor` TEXT

**Risco:** 🟠 Alto — Duplicidade vendedor TEXT + vendedor_id FK  
**Impacto:** Médio  
**Dificuldade:** Média  

**Estado atual:**
- `leads.vendedor` (TEXT, default 'Admin') — usado em ~15 RLS policies
- `leads.vendedor_id` (UUID) — FK já existente
- `orcamentos.vendedor` (TEXT) — sem FK

**Plano de migração:**

```
Etapa A: Backfill vendedor_id em todos os leads que têm vendedor TEXT mas não vendedor_id
Etapa B: Atualizar RLS policies para usar vendedor_id ao invés de vendedor TEXT
Etapa C: Atualizar frontend para usar apenas vendedor_id
Etapa D: Adicionar vendedor_id em orcamentos (FK → vendedores)
Etapa E: Marcar leads.vendedor e orcamentos.vendedor como deprecated
Etapa F (futuro): DROP COLUMN vendedor após validação
```

**Script de backfill:**

```sql
-- Backfill leads
UPDATE leads l
SET vendedor_id = v.id
FROM vendedores v
WHERE l.vendedor = v.nome
  AND l.vendedor_id IS NULL
  AND l.tenant_id = v.tenant_id;

-- Adicionar FK em orcamentos
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);

-- Backfill orcamentos
UPDATE orcamentos o
SET vendedor_id = v.id
FROM vendedores v
WHERE o.vendedor = v.nome
  AND o.vendedor_id IS NULL
  AND o.tenant_id = v.tenant_id;
```

---

## 🟡 FASE 4 — INFRAESTRUTURA SaaS

### 4.1 — Tabelas de Planos e Assinaturas

**Risco:** 🟡 Médio  
**Impacto:** Alto — Necessário para monetização  
**Dificuldade:** Média  

```sql
-- Planos disponíveis
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  descricao TEXT,
  preco_mensal NUMERIC(10,2) NOT NULL DEFAULT 0,
  preco_anual NUMERIC(10,2),
  max_usuarios INT DEFAULT 5,
  max_leads_mes INT DEFAULT 100,
  max_vendedores INT DEFAULT 3,
  max_storage_mb INT DEFAULT 500,
  features JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assinatura de cada tenant
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','past_due','canceled','suspended')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Limites e uso
CREATE TABLE tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  mes_referencia DATE NOT NULL, -- primeiro dia do mês
  leads_criados INT DEFAULT 0,
  mensagens_wa_enviadas INT DEFAULT 0,
  storage_usado_mb NUMERIC(10,2) DEFAULT 0,
  usuarios_ativos INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, mes_referencia)
);

-- Feature flags por tenant
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- NULL = global
  feature_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, feature_key)
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Plans: leitura pública
CREATE POLICY "Public read plans" ON plans FOR SELECT USING (ativo = true);
CREATE POLICY "Super admins manage plans" ON plans FOR ALL USING (is_super_admin(auth.uid()));

-- Subscriptions: somente do próprio tenant
CREATE POLICY "Admins read own subscription" ON subscriptions FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "Super admins manage subscriptions" ON subscriptions FOR ALL
  USING (is_super_admin(auth.uid()));

-- Usage: somente do próprio tenant
CREATE POLICY "Admins read own usage" ON tenant_usage FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Feature flags
CREATE POLICY "Read own flags" ON feature_flags FOR SELECT
  USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);
CREATE POLICY "Super admins manage flags" ON feature_flags FOR ALL
  USING (is_super_admin(auth.uid()));
```

### 4.2 — Function para verificar limites

```sql
CREATE OR REPLACE FUNCTION check_tenant_limit(_tenant_id UUID, _resource TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan plans;
  _usage tenant_usage;
  _current_month DATE;
BEGIN
  _current_month := date_trunc('month', now())::date;
  
  SELECT p.* INTO _plan
  FROM subscriptions s JOIN plans p ON s.plan_id = p.id
  WHERE s.tenant_id = _tenant_id AND s.status IN ('active','trial');
  
  IF _plan IS NULL THEN RETURN false; END IF;
  
  SELECT * INTO _usage
  FROM tenant_usage
  WHERE tenant_id = _tenant_id AND mes_referencia = _current_month;
  
  CASE _resource
    WHEN 'leads' THEN RETURN COALESCE(_usage.leads_criados, 0) < _plan.max_leads_mes;
    WHEN 'usuarios' THEN RETURN COALESCE(_usage.usuarios_ativos, 0) < _plan.max_usuarios;
    WHEN 'vendedores' THEN RETURN (
      SELECT count(*) FROM vendedores WHERE tenant_id = _tenant_id AND ativo = true
    ) < _plan.max_vendedores;
    ELSE RETURN true;
  END CASE;
END;
$$;
```

---

## 🟡 FASE 5 — BANCO DE DADOS ENTERPRISE

### 5.1 — Índices tenant-aware faltantes

**Tabelas SEM índice em tenant_id:**

```sql
-- Configuração
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financiamento_bancos_tenant ON financiamento_bancos(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gamification_config_tenant ON gamification_config(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_config_tenant ON instagram_config(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_posts_tenant ON instagram_posts(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instalador_config_tenant ON instalador_config(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_status_tenant ON lead_status(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payback_config_tenant ON payback_config(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_config_tenant ON webhook_config(tenant_id);

-- Operacional
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_task_events_tenant ON task_events(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meta_notifications_tenant ON meta_notifications(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_layouts_solares_tenant ON layouts_solares(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pagamentos_comissao_tenant ON pagamentos_comissao(tenant_id);

-- WhatsApp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_outbox_tenant ON wa_outbox(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_webhook_events_tenant ON wa_webhook_events(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_tags_tenant ON wa_tags(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_quick_replies_tenant ON wa_quick_replies(tenant_id);

-- Checklists
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_templates_tenant ON checklist_templates(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_template_items_tenant ON checklist_template_items(tenant_id);
```

### 5.2 — `tenant_id` NOT NULL enforcement

**Plano gradual:**
1. Primeiro garantir que TODOS os registros existentes têm tenant_id preenchido
2. Depois aplicar `NOT NULL` constraint

```sql
-- Verificar registros órfãos
SELECT 'leads' AS tabela, COUNT(*) AS orfaos FROM leads WHERE tenant_id IS NULL
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes WHERE tenant_id IS NULL
UNION ALL
SELECT 'orcamentos', COUNT(*) FROM orcamentos WHERE tenant_id IS NULL
-- ... (repetir para todas as tabelas)

-- Após confirmar 0 órfãos:
-- ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE clientes ALTER COLUMN tenant_id SET NOT NULL;
-- ... (uma por vez, com rollback preparado)
```

### 5.3 — Padronização de telefone

**Estado atual:** `leads.telefone_normalized` já existe com trigger `check_lead_rate_limit`

```sql
-- Garantir normalização em todas as tabelas com telefone
CREATE OR REPLACE FUNCTION normalize_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_normalized := regexp_replace(NEW.telefone, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Aplicar em clientes (já existe trigger normalize_cliente_telefone)
-- Verificar se vendedores tem telefone (se tiver, adicionar trigger)
```

---

## 🟢 FASE 6 — PERFORMANCE E ESCALA

### 6.1 — Simulação de 1.000 tenants

**Gargalos identificados:**

| Gargalo | Severidade | Causa |
|---------|-----------|-------|
| RLS sem índice em tenant_id | 🔴 Crítico | Full table scan em cada query |
| `get_user_tenant_id()` chamada N vezes por request | 🟠 Alto | Sem cache de sessão |
| Materialized views sem refresh automático | 🟠 Alto | Views ficam stale |
| `leads` + `orcamentos` sem partitioning | 🟡 Médio | Tabelas crescerão muito |
| `audit_logs` sem partitioning | 🟡 Médio | Tabela de append-only |
| Subqueries em RLS policies | 🟠 Alto | `vendedor IN (SELECT nome FROM vendedores WHERE...)` é lento |

### 6.2 — Plano preventivo

```sql
-- 1. Cache de tenant_id na sessão (evita N chamadas)
-- Já resolvido pelo get_user_tenant_id() que é STABLE

-- 2. Reescrever policies com subqueries pesadas
-- ANTES (lento com 1000 tenants):
-- vendedor IN (SELECT nome FROM vendedores WHERE user_id = auth.uid())
-- DEPOIS (rápido):
CREATE OR REPLACE FUNCTION get_user_vendedor_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM vendedores WHERE user_id = auth.uid() LIMIT 1;
$$;
-- Usar: vendedor_id = get_user_vendedor_id()

-- 3. Particionamento de audit_logs por mês (futuro)
-- 4. Particionamento de leads por tenant_id (futuro, quando > 100k registros)

-- 5. Refresh de materialized views via pg_cron
-- SELECT cron.schedule('refresh_dashboard', '*/15 * * * *', 'SELECT refresh_dashboard_views()');
```

---

## ORDEM DE EXECUÇÃO RECOMENDADA

| Fase | Prioridade | Esforço | Dependências | Ordem |
|------|-----------|---------|--------------|-------|
| 0.1 — Fix defaults hardcoded | 🔴 | ⚡ 1h | Nenhuma | **1º** |
| 0.2 — Fix defaults NULL | 🔴 | ⚡ 30min | Nenhuma | **1º** (paralelo) |
| 0.3 — Reescrever RLS policies | 🔴 | 🔧 8-12h | 0.1 + 0.2 | **2º** |
| 1.1 — JWT em edge functions | 🔴 | 🔧 4-6h | Nenhuma | **2º** (paralelo) |
| 0.5 — Tenant guard em functions | 🔴 | 🔧 6-8h | 0.3 + 1.1 | **3º** |
| 2.1 — Migrar tokens para Vault | 🔴 | 🔧 4h | 0.5 | **4º** |
| 0.4 — Storage isolation | 🟠 | 🔧 3-4h | 0.1 | **5º** |
| 1.2 — Rate limiting | 🟠 | 🔧 2-3h | Nenhuma | **5º** (paralelo) |
| 1.3 — Idempotência webhooks | 🟠 | ⚡ 1h | Nenhuma | **5º** (paralelo) |
| 1.4 — Retry com backoff | 🟡 | ⚡ 1h | 1.3 | **6º** |
| 3.2 — Eliminar vendedor TEXT | 🟠 | 🔧 4-6h | 0.3 | **7º** |
| 5.1 — Índices tenant-aware | 🟡 | ⚡ 30min | 0.1 | **7º** (paralelo) |
| 3.1 — Unificar whatsapp tables | 🟠 | ⏳ 8-12h | 0.3 | **8º** |
| 5.2 — NOT NULL enforcement | 🟡 | 🔧 2h | 0.1 + 0.2 | **9º** |
| 4.1 — Planos e assinaturas | 🟡 | 🔧 3-4h | Nenhuma | **10º** |
| 6.2 — Otimizações de performance | 🟢 | 🔧 4-6h | 0.3 | **11º** |

**Legenda:** ⚡ = Quick win | 🔧 = Esforço moderado | ⏳ = Esforço alto

---

## CHECKLIST PRÉ-EXECUÇÃO

Antes de executar QUALQUER migration deste plano:

- [ ] Backup completo do banco de produção
- [ ] Testar migration em ambiente de staging
- [ ] Verificar que rollback scripts estão preparados
- [ ] Comunicar período de manutenção
- [ ] Validar que nenhum cron job está rodando durante a migration
- [ ] Ter acesso ao Supabase Dashboard para monitoramento

---

## NOTAS IMPORTANTES

1. **NUNCA deletar tabelas `whatsapp_*` sem confirmar que ZERO dados relevantes existem**
2. **RLS policies devem ser testadas com usuários de DIFERENTES tenants**
3. **Edge functions devem ter testes automatizados antes do hardening**
4. **O campo `vendedor` TEXT deve ser mantido como deprecated (read-only) por pelo menos 30 dias antes de ser removido**
5. **Materialized views precisam ser recriadas com filtro de tenant_id**
6. **`get_user_tenant_id()` retorna UUID fixo para usuários sem profile — isso deve ser tratado como "tenant demo/sandbox"**
