# 7 — REGRAS ARQUITETURAIS IMUTÁVEIS

> **Status**: PERMANENTE. Estas regras NÃO podem ser violadas por nenhum engenheiro, em nenhuma circunstância, sem aprovação unânime do board de arquitetura.
> **Enforcement**: Code review obrigatório. Qualquer PR que viole estas regras é rejeitado automaticamente.

---

## R01 — ISOLAMENTO MULTI-TENANT É SAGRADO

**Nunca** permitir que dados de um tenant sejam acessíveis por outro tenant.

- Toda tabela transacional DEVE ter `tenant_id NOT NULL`
- Toda RLS policy DEVE filtrar por `tenant_id` via `get_user_tenant_id()`
- Toda Edge Function com `service_role` DEVE receber e validar `tenant_id` explicitamente
- Storage paths DEVEM ser prefixados com `{tenant_id}/`
- Queries no frontend NUNCA devem construir filtros de tenant manualmente — confiar no RLS

**Teste**: Uma query com JWT do tenant A NUNCA deve retornar 1 row do tenant B. Se retornar, é vulnerabilidade P0.

---

## R02 — ROLES NUNCA EM PROFILES OU AUTH.USERS

**Nunca** armazenar roles diretamente em `profiles`, `auth.users`, localStorage ou sessionStorage.

- Roles vivem EXCLUSIVAMENTE em `user_roles`
- `user_roles` DEVE ter `tenant_id NOT NULL` (roles órfãs são proibidas)
- Verificação de role DEVE usar `SECURITY DEFINER` functions (`is_admin()`, `is_super_admin()`, `has_role()`)
- Frontend NUNCA deve cachear roles localmente para decisões de autorização

**Motivo**: Privilege escalation. Se role está em profile, usuário pode manipular via update.

---

## R03 — AUDIT TRAIL É IMUTÁVEL

**Nunca** permitir UPDATE ou DELETE em `audit_logs` ou `super_admin_actions`.

- Triggers de proteção impedem UPDATE e DELETE em `audit_logs`
- INSERT direto em `audit_logs` é proibido (apenas via trigger com `app.audit_trigger_active`)
- `super_admin_actions` registra TODA mutação administrativa
- Before/after state DEVE ser capturado para ações sensíveis

**Motivo**: Trilha de auditoria é requisito legal (LGPD) e operacional.

---

## R04 — NUNCA POLLING + REALTIME NO MESMO RECURSO

**Nunca** combinar `refetchInterval` com Supabase Realtime subscription na mesma query.

- Escolher UM: Realtime (preferido) OU polling com intervalo longo (≥60s)
- Se Realtime, usar debounce de 500ms para invalidação de cache
- Se polling, documentar o motivo (ex: Realtime não suporta o padrão de query)

**Motivo**: Query storms. Polling + Realtime = duplicação de queries = connection pool exhaustion.

---

## R05 — EDGE FUNCTIONS DEVEM VALIDAR TENANT STATUS

**Nunca** processar lógica de negócio sem verificar se o tenant está ativo.

- Toda Edge Function que processa dados de tenant DEVE verificar `tenant_is_active()` ou `tenants.status = 'active'`
- Se tenant suspended/disabled/deleted → retornar 403 com mensagem clara
- Automações (follow-ups, outbox) DEVEM skip tenants inativos silenciosamente

**Motivo**: Tenant suspenso/deletado não pode gerar ações (mensagens, leads, notificações).

---

## R06 — ÚLTIMO ADMIN É PROTEGIDO

**Nunca** permitir remoção do último admin/gerente de um tenant.

- `is_last_admin_of_tenant()` DEVE ser chamada antes de:
  - Remover role admin/gerente
  - Desativar usuário com role admin
  - Soft delete de usuário admin
- Se é o último → operação DEVE falhar com erro explícito

**Motivo**: Tenant sem admin = empresa sem acesso = dados órfãos = suporte manual.

---

## R07 — NUNCA `instance_id` EM PAYLOADS DE AUTOMAÇÃO

**Nunca** permitir que automações alterem o `instance_id` de uma conversa.

- `instance_id` é definido na criação da conversa (pelo webhook)
- Automações (follow-up, outbox) usam o `instance_id` existente da conversa
- Transferência de conversa altera `assigned_to`, NUNCA `instance_id`

**Motivo**: `instance_id` é a identidade física da conexão WhatsApp. Alterar = mensagens enviadas pelo canal errado.

---

## R08 — MIGRATIONS NUNCA DESTRUTIVAS SEM VERIFICAÇÃO

**Nunca** executar `DROP TABLE`, `DROP COLUMN`, ou `ALTER TYPE` sem:

1. Verificar se há dados no ambiente Live
2. Criar migration de backup/archival se dados existem
3. Documentar impacto em `docs/architecture/`
4. Testar em ambiente de test primeiro

**Motivo**: Dados de clientes reais são irrecuperáveis se deletados sem backup.

---

## R09 — SERVICE_ROLE KEY NUNCA NO FRONTEND

**Nunca** expor `SUPABASE_SERVICE_ROLE_KEY` em código frontend, variáveis VITE_, ou localStorage.

- `service_role` é usado EXCLUSIVAMENTE em Edge Functions (server-side)
- Frontend usa APENAS `anon` key com RLS
- Se uma operação requer service_role, criar Edge Function

**Motivo**: Service role bypassa ALL RLS. Exposição = acesso total a todos os dados de todos os tenants.

---

## R10 — QUERIES NO FRONTEND DEVEM SELECIONAR COLUNAS EXPLÍCITAS

**Nunca** (a partir de agora) usar `select("*")` em queries de produção.

- Paths quentes (inbox, leads, orcamentos): seleção explícita obrigatória
- Paths frios (configurações, admin): tolerável temporariamente (dívida existente)
- Novas queries: colunas explícitas obrigatórias desde o primeiro commit

**Motivo**: Performance (index-only scans), segurança (não expor colunas desnecessárias), resiliência (schema changes não quebram queries).

---

## R11 — DADOS SENSÍVEIS NUNCA EM LOGS

**Nunca** logar:
- Senhas, tokens, API keys
- CPF/CNPJ completos
- Conteúdo de mensagens WhatsApp
- Dados financeiros de clientes

Em logs de debug, usar masking: `***${last4digits}`.

**Motivo**: LGPD compliance. Logs são acessíveis por mais pessoas que o banco.

---

## R12 — TODA TABELA NOVA EXIGE CHECKLIST

Antes de criar qualquer tabela:

- [ ] Coluna `tenant_id NOT NULL` com FK para `tenants`?
- [ ] RLS habilitado?
- [ ] Policy de SELECT filtra por tenant?
- [ ] Policy de INSERT valida tenant via `get_user_tenant_id()`?
- [ ] Policy de UPDATE/DELETE filtra por tenant?
- [ ] Índice em `tenant_id`?
- [ ] Índice composto para queries frequentes?
- [ ] Limites de plano verificados (`check_tenant_limit`)? 
- [ ] Audit trigger (se tabela sensível)?
- [ ] Documentada em `docs/architecture/`?

**Motivo**: Uma tabela sem RLS = vazamento total de dados cross-tenant.
