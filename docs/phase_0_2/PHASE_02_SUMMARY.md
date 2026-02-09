# Fase 0.2 — Reescrita de RLS Policies (Multi-Tenant)

## Resumo Executivo

| Item | Valor |
|------|-------|
| Tabelas afetadas | **~100 de 108** |
| Policies antigas removidas (004) | **~180** |
| Policies novas criadas (003) | **~220** |
| Tabelas preservadas (já corretas) | **8** |
| Tabelas sem tenant_id (gap) | **3** |

## O que muda

### Antes (vulnerável)
```sql
-- Policy típica: admin vê TUDO (qualquer tenant)
CREATE POLICY "Admins manage leads" ON leads
  FOR ALL USING (is_admin(auth.uid()));
```

### Depois (isolado)
```sql
-- Admin vê apenas dados do SEU tenant
CREATE POLICY "rls_leads_all_admin" ON leads
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
```

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
  vendedor_performance_mensal, sla_breaches (add delete)

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

### Classe G — PUBLIC_INSERT (1 tabela adicional)
Anônimos podem inserir.

- simulacoes (leads e orcamentos em Classe C)

### Classe H — SITE_PUBLIC (1 tabela)
Leitura pública, admin escreve com tenant.

- site_servicos (site_banners e site_settings já corretos)

### Tabelas PRESERVADAS (7)
Já possuem filtro tenant_id correto nas policies.

- lead_distribution_log, lead_distribution_rules, motivos_perda,
  site_banners, site_settings, tenants, wa_satisfaction_ratings

### Tabelas SEM tenant_id (3 — gap para Fase 3)
- wa_conversation_tags, whatsapp_conversation_tags, backfill_audit

## Riscos e Mitigação

### ⚠️ Risco 1: Policies OR entre 003 e 004
**Problema**: Policies PERMISSIVE usam lógica OR. Entre aplicar 003 e 004,
as policies antigas ainda permitem acesso cross-tenant.
**Mitigação**: Aplicar 004 imediatamente após validar 003. Zero gap.

### ⚠️ Risco 2: Inserts públicos (leads/orcamentos)
**Problema**: `require_tenant_id()` como DEFAULT falha para `auth.uid() = NULL`
(usuários anônimos). Formulário público pode estar quebrado desde Phase 0.1.1.
**Mitigação**: Trocar DEFAULT de `require_tenant_id()` para `get_user_tenant_id()`
nessas tabelas (fix separado, pré-requisito para produção).

### ⚠️ Risco 3: Edge functions e service_role
**Problema**: Edge functions usam service_role. Novas policies de service_role
exigem `tenant_id IS NOT NULL` no WITH CHECK.
**Mitigação**: Verificar que TODAS as edge functions passam tenant_id explicitamente
nos inserts. Lista de edge functions a verificar:
- evolution-webhook ✅ (já passa tenant_id)
- process-wa-outbox ✅ (já passa)
- send-whatsapp-message ✅
- solar-market-sync ⚠️ (verificar)
- instagram-sync ⚠️ (verificar)
- process-webhook-events ⚠️ (verificar)

### ⚠️ Risco 4: Subqueries em policies de vendedor
**Problema**: Policies de vendedor usam subquery `vendedor IN (SELECT nome FROM vendedores WHERE user_id = auth.uid())`.
Se as subqueries não incluírem tenant_id, um vendedor poderia ver dados de outro tenant
caso houvesse vendedores com mesmo nome em tenants diferentes.
**Mitigação**: TODAS as subqueries incluem `AND v.tenant_id = get_user_tenant_id()`.

### ⚠️ Risco 5: Dados públicos do site vazam entre tenants
**Problema**: Policies com `USING (true)` para SELECT anon em tabelas como
brand_settings, obras, instagram_posts, etc. Um tenant vê dados públicos de outro.
**Mitigação**: Aceitável por ora (dados são públicos por natureza). O frontend
já filtra por tenant. Para isolamento completo, implementar filtro tenant em
queries anônimas na Fase 3.

## Como Reverter

### Rollback de 004 (restaurar policies legadas)
Executar o conteúdo original da migration 003 invertido:
- Recriar todas as policies antigas com seus nomes e condições originais

### Rollback de 003 (remover novas policies)
```sql
-- Remover todas as policies com prefixo rls_
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
```

## Checklist para Produção

- [ ] Aplicar 003 em staging
- [ ] Executar checks A-F → todos verdes
- [ ] Aplicar 004 em staging
- [ ] Executar checks A-F novamente → zero policies sem tenant
- [ ] Executar canary tests → isolamento confirmado
- [ ] Executar smoke tests → todos os fluxos funcionando
- [ ] Fix do DEFAULT em leads/orcamentos (require_tenant_id → get_user_tenant_id)
- [ ] Verificar edge functions passam tenant_id
- [ ] Aprovar para produção
- [ ] Aplicar 003 + 004 em produção (sequencial, sem gap)
- [ ] Smoke test em produção
- [ ] Atualizar HARDENING_PLAN.md
