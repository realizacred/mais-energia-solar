# Fase 0.2 — Reescrita de RLS Policies (Multi-Tenant) — v2

## Resumo Executivo

| Item | Valor |
|------|-------|
| Tabelas afetadas | **~100 de 108** |
| Policies antigas removidas (004) | **~180** |
| Policies novas criadas (003) | **~220** |
| Tabelas preservadas (já corretas) | **8** |
| Tabelas sem tenant_id (gap Fase 3) | **3** |
| Edge functions corrigidas | **3** |
| Triggers de resolução anon criados | **3** |

---

## ⚡ PLANO DE DEPLOY (RISCO 1 — Zero Gap)

### Ordem de Execução (STAGING)

```
┌───────────────────────────────────────────────────────────────┐
│  SESSÃO ÚNICA — NÃO PAUSAR ENTRE PASSOS                     │
│                                                               │
│  1. Aplicar CORREÇÕES PRÉ-REQUISITO (dentro do 003.v2)       │
│     → resolve_public_tenant_id()                              │
│     → Triggers: resolve_lead_tenant, resolve_orc_tenant,      │
│       resolve_sim_tenant                                      │
│     → ALTER DEFAULT em leads/orcamentos/simulacoes            │
│                                                               │
│  2. Aplicar 003.v2 (criar ~220 novas rls_ policies)          │
│     → Transaction: BEGIN...COMMIT                             │
│                                                               │
│  3. Rodar CHECK A-F (verificações automáticas)                │
│     → TODAS as tabelas devem ter policies rls_                │
│     → Confirmar que policies legadas AINDA existem (OR logic) │
│                                                               │
│  4. Aplicar 004.v2 (remover ~180 policies legadas)            │
│     → Transaction: BEGIN...COMMIT                             │
│                                                               │
│  5. Rodar CHECK A-F NOVAMENTE                                 │
│     → Zero policies legadas restantes                         │
│     → Todas as tabelas com tenant_id filtrado                 │
│                                                               │
│  6. Rodar CANARY TESTS (isolamento cross-tenant)              │
│                                                               │
│  7. Rodar SMOKE TESTS (fluxos do frontend)                    │
│     → Inclui testes de INSERT anônimo (leads/orc/sim)         │
│                                                               │
│  8. Deploy edge functions corrigidas                          │
│     → instagram-sync (add tenant_id)                          │
│     → send-whatsapp-message (add tenant_id)                   │
│     → process-whatsapp-automations (add tenant_id)            │
│                                                               │
│  9. Re-testar fluxos WA e Instagram                           │
└───────────────────────────────────────────────────────────────┘
```

### Ordem de Execução (PRODUÇÃO)

```
1. Aplicar 003.v2   (mesma sessão)
2. Aplicar 004.v2   (mesma sessão, sem intervalo)
3. Deploy edge functions corrigidas
4. Smoke test em produção
5. Atualizar HARDENING_PLAN.md
```

**REGRA**: Entre 003 e 004 NÃO pode haver gap. Policies PERMISSIVE
usam OR — enquanto as legadas existirem, acesso cross-tenant persiste.

---

## 📋 TABELAS COM INSERT ANÔNIMO

### Inventário Completo

| Tabela | Rota/Fluxo | Como tenant_id é resolvido (v2) |
|--------|-----------|-------------------------------|
| **leads** | Formulário público do site (`LeadFormWizard`) | Trigger `resolve_lead_tenant_id_trg`: vendedor → vendedores.tenant_id → fallback single tenant |
| **orcamentos** | Formulário público do site (vinculado a lead) | Trigger `resolve_orc_tenant_id_trg`: lead_id → leads.tenant_id → fallback single tenant |
| **simulacoes** | Calculadora pública | Trigger `resolve_sim_tenant_id_trg`: fallback single tenant |

### Estratégia de Resolução de Tenant (Anônimo)

```
┌─────────────────────────────────────────────────┐
│  TRIGGER BEFORE INSERT (para cada tabela)       │
│                                                  │
│  1. Se tenant_id já está setado → manter         │
│     (path service_role / edge function)          │
│                                                  │
│  2. Se campo "vendedor" existe → resolver via    │
│     vendedores.codigo/slug → tenant_id           │
│                                                  │
│  3. Se lead_id existe (orcamentos) → resolver    │
│     via leads.tenant_id                          │
│                                                  │
│  4. Fallback → resolve_public_tenant_id():       │
│     - Se 1 tenant ativo → retorna esse           │
│     - Se 0 ou >1 → RAISE EXCEPTION              │
│                                                  │
│  5. Se AINDA NULL → RAISE EXCEPTION              │
│     'Não foi possível resolver tenant_id'        │
└─────────────────────────────────────────────────┘
```

### Validação no RLS (WITH CHECK)

```sql
-- Exemplo: leads INSERT anônimo
CREATE POLICY "rls_leads_insert_public"
  ON public.leads FOR INSERT TO anon
  WITH CHECK (
    tenant_id IS NOT NULL  -- ← OBRIGATÓRIO (resolvido pelo trigger)
    AND nome IS NOT NULL AND length(TRIM(BOTH FROM nome)) >= 2
    AND telefone IS NOT NULL AND length(TRIM(BOTH FROM telefone)) >= 10
    ...
  );
```

### Por que NÃO usar DEFAULT da coluna?

- `require_tenant_id()` depende de `auth.uid()` → NULL para anon → exception
- `get_user_tenant_id()` retorna NULL para anon → violaria `NOT NULL` no WITH CHECK
- Trigger BEFORE INSERT é a melhor opção: pode usar lógica condicional
  (vendedor lookup, lead lookup, fallback)

---

## 🔌 EDGE FUNCTIONS PÚBLICAS — AUDITORIA

### Mapa Completo

| Edge Function | Entrada | Autenticação | Tenant Derivation | Status |
|---|---|---|---|---|
| `evolution-webhook` | Webhook público (Evolution API) | Secret por instância | `wa_instances` lookup → `instance.tenant_id` | ✅ OK |
| `solar-market-webhook` | Webhook público (SolarMarket) | `x-webhook-secret` header | `solar_market_config` lookup → `config.tenant_id` | ✅ OK |
| `process-webhook-events` | Interno (chamado por evolution-webhook) | service_role | Herda `event.tenant_id` do wa_webhook_events | ✅ OK |
| `webhook-lead` | DB trigger webhook | N/A | Apenas encaminha payload, sem INSERT direto | ✅ N/A |
| `solar-market-sync` | Autenticado (admin) | JWT admin | `solar_market_config.tenant_id` em TODOS os inserts/upserts | ✅ OK |
| `process-wa-outbox` | Interno (cron/service_role) | service_role | Apenas UPDATE em registros existentes | ✅ OK |
| `send-whatsapp-message` | Autenticado (JWT) | JWT required | **❌ FALTANDO**: insert em `whatsapp_messages` sem tenant_id | ❌ FIX |
| `instagram-sync` | Autenticado (admin) | JWT admin | **❌ FALTANDO**: insert em `instagram_posts` sem tenant_id | ❌ FIX |
| `process-whatsapp-automations` | Interno | service_role | **❌ FALTANDO**: insert em `whatsapp_automation_logs` sem tenant_id | ❌ FIX |
| `create-vendedor-user` | Autenticado (admin) | JWT admin | Cria user no auth, não insere em tabelas operacionais | ✅ N/A |
| `lead-scoring` | Autenticado | JWT | Lê/atualiza via supabase client (RLS aplica) | ✅ N/A |
| `check-wa-instance-status` | Autenticado | JWT | Apenas leitura | ✅ N/A |
| `test-evolution-connection` | Autenticado | JWT | Apenas leitura/teste externo | ✅ N/A |

### Correções Necessárias

#### 1. `instagram-sync` — Linha 110-118
```diff
  const postsToInsert = media.map((item: any) => ({
+   tenant_id: config.tenant_id,  // ← ADICIONAR
    instagram_id: item.id,
    media_type: item.media_type,
    ...
  }));
```
**Nota**: Precisa também buscar `tenant_id` do `config` (adicionar ao SELECT na linha 64).

#### 2. `send-whatsapp-message` — Linha 233
```diff
  const { error: logError } = await supabase.from("whatsapp_messages").insert({
+   tenant_id: get_user_tenant_id_from_claims,  // ← ADICIONAR
    lead_id: lead_id || null,
    tipo,
    ...
  });
```
**Nota**: Como o insert usa o supabase client autenticado (não admin),
o DEFAULT `get_user_tenant_id()` funcionaria via context do JWT. MAS o DEFAULT
atual é `require_tenant_id()` que pode falhar. Melhor: buscar tenant_id do
profile do user e passar explicitamente.

#### 3. `process-whatsapp-automations` — Linha 178
```diff
  await supabaseAdmin.from("whatsapp_automation_logs").insert({
+   tenant_id: config.tenant_id,  // ← ADICIONAR (config da whatsapp_automation_config)
    template_id: template.id,
    ...
  });
```
**Nota**: Precisa buscar `tenant_id` do `config` (adicionar ao SELECT na linha 63).

---

## Classificação de Tabelas

### Classe A — TENANT_ADMIN_ONLY (16 tabelas)
Admin do tenant lê/escreve. Sem acesso para users comuns.

- ai_insights, audit_logs, calculadora_config, financiamento_api_config,
  instagram_config, pagamentos, pagamentos_comissao, parcelas,
  recebimentos, release_checklists, solar_market_config, webhook_config,
  whatsapp_automation_config, whatsapp_automation_logs,
  whatsapp_messages, wa_webhook_events

### Classe B — TENANT_USER_READ + ADMIN_WRITE (25 tabelas)
Todos os users autenticados do tenant podem LER. Admin escreve.

- baterias, brand_settings, checklist_template_items, checklist_templates,
  concessionarias, config_tributaria_estado, disjuntores, financiamento_bancos,
  fio_b_escalonamento, gamification_config, instalador_config, inversores,
  lead_scoring_config, lead_status, modulos_fotovoltaicos, payback_config,
  proposal_variables, sla_rules, transformadores, vendedores,
  wa_quick_replies, wa_quick_reply_categories, wa_tags,
  whatsapp_automation_templates, whatsapp_tags

### Classe C — TENANT_HYBRID (26 tabelas)
Admin acesso total + owner/vendedor/instalador acesso parcial.

- leads, orcamentos, clientes, comissoes, projetos, propostas,
  proposta_itens, proposta_variaveis, lead_atividades, lead_scores,
  lead_links, servicos_agendados, checklists_cliente,
  checklist_cliente_arquivos, checklist_cliente_respostas,
  meta_notifications, tasks, task_events, obras,
  instalador_metas, instalador_performance_mensal,
  vendedor_achievements, vendedor_metas, vendedor_metricas,
  vendedor_performance_mensal, sla_breaches

### Classe D — TENANT_OWNER_ONLY (8 tabelas)
Owner (user_id) + admin override + tenant.

- profiles, user_roles, checklists_instalacao, checklists_instalador,
  checklist_instalador_arquivos, checklist_instalador_respostas,
  layouts_solares, whatsapp_reminders

### Classe E — SERVICE_ONLY + ADMIN_READ (13 tabelas)
Escrita via service_role. Admin pode ler.

- instagram_posts, solar_market_clients, solar_market_custom_fields,
  solar_market_custom_fields_catalog, solar_market_funnels,
  solar_market_funnels_catalog, solar_market_integration_requests,
  solar_market_projects, solar_market_proposals,
  solar_market_sync_items_failed, solar_market_sync_logs,
  solar_market_users, solar_market_webhook_events

### Classe F — WHATSAPP_HYBRID (8 tabelas)
Admin + vendor via instance/conversa + service_role.

- wa_instances, wa_conversations, wa_messages, wa_outbox, wa_transfers,
  whatsapp_conversations, whatsapp_conversation_messages, whatsapp_transfers

### Classe G — PUBLIC_INSERT (3 tabelas)
Anônimos podem inserir. Tenant resolvido via trigger.

- leads, orcamentos, simulacoes

### Classe H — SITE_PUBLIC (1 tabela)
Leitura pública, admin escreve com tenant.

- site_servicos (site_banners e site_settings já corretos)

### Tabelas PRESERVADAS (8)
Já possuem filtro tenant_id correto nas policies.

- lead_distribution_log, lead_distribution_rules, motivos_perda,
  site_banners, site_settings, tenants, wa_satisfaction_ratings,
  sla_breaches (exceto DELETE adicionado em 003)

### Tabelas SEM tenant_id (3 — gap para Fase 3)
- wa_conversation_tags, whatsapp_conversation_tags, backfill_audit

---

## Riscos e Mitigação

### ✅ Risco 1: Gap entre 003 e 004 — RESOLVIDO
**Solução**: Deploy em sessão única, sem intervalo. Documentado no plano acima.

### ✅ Risco 2: Inserts anônimos — RESOLVIDO
**Solução**: Triggers BEFORE INSERT que resolvem tenant_id via:
- vendedor code → vendedores.tenant_id
- lead_id → leads.tenant_id (para orcamentos)
- Fallback: resolve_public_tenant_id() (single tenant)
- WITH CHECK valida tenant_id IS NOT NULL

### ✅ Risco 3: Edge functions sem tenant_id — RESOLVIDO
**Solução**: 3 edge functions corrigidas para passar tenant_id explicitamente:
- instagram-sync: tenant_id do instagram_config
- send-whatsapp-message: tenant_id do profile do user logado
- process-whatsapp-automations: tenant_id do whatsapp_automation_config

### ⚠️ Risco 4: Subqueries em policies de vendedor
**Status**: MITIGADO. TODAS as subqueries incluem `AND v.tenant_id = get_user_tenant_id()`.

### ⚠️ Risco 5: Dados públicos do site vazam entre tenants
**Status**: Aceito. brand_settings, obras, instagram_posts usam `USING (true)` para SELECT anon.
Frontend filtra por tenant. Isolamento completo na Fase 3.

---

## Como Reverter

### Rollback de 003+004 (restaurar estado anterior)

```sql
-- PASSO 1: Remover todas as policies com prefixo rls_
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'rls_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- PASSO 2: Recriar policies legadas
-- (usar backup das policies originais — disponível no git history)

-- PASSO 3: Reverter triggers de resolução anon
DROP TRIGGER IF EXISTS resolve_lead_tenant_id_trg ON public.leads;
DROP TRIGGER IF EXISTS resolve_orc_tenant_id_trg ON public.orcamentos;
DROP TRIGGER IF EXISTS resolve_sim_tenant_id_trg ON public.simulacoes;
DROP FUNCTION IF EXISTS resolve_lead_tenant_id();
DROP FUNCTION IF EXISTS resolve_orc_tenant_id();
DROP FUNCTION IF EXISTS resolve_sim_tenant_id();
DROP FUNCTION IF EXISTS resolve_public_tenant_id();

-- PASSO 4: Restaurar DEFAULTs originais
ALTER TABLE leads ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE orcamentos ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
ALTER TABLE simulacoes ALTER COLUMN tenant_id SET DEFAULT require_tenant_id();
```

---

## Checklist para Produção

- [ ] Revisar 003.v2 e 004.v2 (este documento)
- [ ] Aplicar 003.v2 em staging (sessão única)
- [ ] Executar checks A-F → todos verdes
- [ ] Aplicar 004.v2 em staging (mesma sessão)
- [ ] Executar checks A-F novamente → zero policies legadas sem tenant
- [ ] Executar canary tests → isolamento confirmado
- [ ] Testar INSERT anônimo: leads via formulário público
- [ ] Testar INSERT anônimo: orcamento via formulário público
- [ ] Testar INSERT anônimo: simulação via calculadora
- [ ] Deploy edge functions corrigidas (instagram-sync, send-whatsapp-message, process-whatsapp-automations)
- [ ] Testar Instagram sync (admin)
- [ ] Testar envio WhatsApp (vendedor)
- [ ] Executar smoke tests completos (10 áreas)
- [ ] Aprovar para produção
- [ ] Aplicar 003.v2 + 004.v2 em produção (sequencial, sem gap)
- [ ] Deploy edge functions em produção
- [ ] Smoke test em produção
- [ ] Atualizar HARDENING_PLAN.md
