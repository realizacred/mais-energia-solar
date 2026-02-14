# 6 — DÍVIDA TÉCNICA ESTRATÉGICA

> **Propósito**: Classificar e rastrear dívida técnica com impacto futuro quantificado.
> **Regra**: Dívida proibida deve ser corrigida imediatamente. Dívida perigosa tem deadline.

---

## 6.1 — Dívida Aceitável (baixo risco, custo controlado)

### DA-01: 50 Edge Functions sem shared modules
- **O que é**: Cada função reimporta `createClient`, reinventa validação de auth, resolve tenant independentemente.
- **Custo atual**: ~30min extras por nova Edge Function (copiar boilerplate)
- **Custo futuro**: Se um padrão de auth mudar, 50 arquivos precisam update. Mas cada update é mecânico.
- **Quando corrigir**: Quando o número de funções passar de 60, criar shared module.
- **Risco de NÃO corrigir**: Inconsistência de validação entre funções (já mitigado por code review).

### DA-02: Materialized Views com refresh por cron (dados stale)
- **O que é**: Dashboards mostram dados com delay de até 15 minutos (frequência do cron).
- **Custo atual**: UX aceitável. Usuários não notam delay em métricas agregadas.
- **Custo futuro**: Com mais tenants, refresh fica mais lento.
- **Quando corrigir**: Quando refresh time ultrapassar 10 segundos.
- **Risco de NÃO corrigir**: Nenhum impacto operacional. Apenas precisão temporal.

### DA-03: PWA com sync offline limitado
- **O que é**: Apenas leads e checklists são sincronizados offline via Dexie.
- **Custo atual**: Funcionalidade suficiente para campo (instaladores).
- **Custo futuro**: Se mais features precisarem offline, Dexie schema cresce.
- **Quando corrigir**: Quando demanda por offline for maior que leads + checklists.

---

## 6.2 — Dívida Perigosa (risco crescente, deadline necessário)

### DP-01: `select("*")` em 68 arquivos — ⏰ DEADLINE: Próximo trimestre
- **O que é**: Queries que carregam todas as colunas de tabelas inteiras.
- **Custo atual**: ~20% de tráfego desnecessário. Index-only scans impossíveis.
- **Custo futuro**: Cada nova coluna = mais bytes por query × usuários × frequência. Scaling linear do desperdício.
- **Mecanismo da dor**: Com 100 colunas em `leads` e 1000 queries/min, são GBs de dados desnecessários transferidos por dia.
- **Como corrigir**: Script de migração: `grep -r 'select("*")' src/` → substituir por colunas explícitas progressivamente. Priorizar tabelas hot: `wa_messages`, `leads`, `orcamentos`.

### DP-02: Frontend como camada de dados (522 queries diretas) — ⏰ DEADLINE: 6 meses
- **O que é**: Componentes React fazem queries Supabase diretamente, sem abstração.
- **Custo atual**: Schema change requer varredura de 54 arquivos.
- **Custo futuro**: Com 100+ componentes com queries, cada migration é uma varredura manual. Risco de regressão silenciosa cresce exponencialmente.
- **Mecanismo da dor**: Engenheiro novo altera tabela `leads` → 12 componentes quebram silenciosamente → descoberto por usuário em produção.
- **Como corrigir**: Repository pattern progressivo. Criar `src/data/leads.ts`, `src/data/conversations.ts`, etc. Mover queries para lá. Componentes importam apenas do repository.

### DP-03: Postgres como fila de mensagens — ⏰ DEADLINE: 1 ano ou 500 tenants (o que vier primeiro)
- **O que é**: `wa_webhook_events` e `wa_outbox` usadas como filas de mensagens.
- **Custo atual**: Funciona. Bloat de 52MB é gerenciável com VACUUM.
- **Custo futuro**: Com 100k webhooks/dia, bloat atinge GBs. VACUUM não acompanha. Latência de processamento cresce não-linearmente.
- **Mecanismo da dor**: INSERT rate > VACUUM rate → dead tuples acumulam → tabela cresce → seq scans ficam lentos → timeout de processamento → backlog cresce → cascata.
- **Como corrigir**: Migrar para Supabase Queues (quando GA) ou Redis Streams (Upstash) para filas de alta throughput.

### DP-04: Sem testes automatizados — ⏰ DEADLINE: Próximo trimestre
- **O que é**: Zero testes unitários, integração ou E2E no projeto.
- **Custo atual**: Qualquer refactor é manual testing only.
- **Custo futuro**: Com 140 tabelas e 50 Edge Functions, regressões são inevitáveis e silenciosas.
- **Mecanismo da dor**: Engenheiro altera RLS policy → vendedor para de ver seus leads → descoberto 3 dias depois por reclamação.
- **Como corrigir**: 1) Testes de RLS isolation (query com token A nunca retorna dados de B). 2) Testes de Edge Functions críticas (webhook processing, send message). 3) Smoke tests de rotas principais.

### DP-05: `resolve_public_tenant_id()` single-tenant assumption — ⏰ DEADLINE: Antes do 2º tenant
- **O que é**: Função assume exatamente 1 tenant ativo. Com 2+, inserções anônimas PARAM.
- **Custo atual**: Zero (1 tenant ativo).
- **Custo futuro**: SISTEMA PARA no momento que o 2º tenant é ativado.
- **Mecanismo da dor**: Super Admin ativa tenant B → formulário público de leads para de funcionar para TODOS → leads perdidos → revenue loss imediato.
- **Como corrigir**: Exigir tenant context explícito via consultor_code no link ou domain-based resolution.

---

## 6.3 — Dívida Proibida (corrigir imediatamente)

### DX-01: Leaked password protection DESATIVADA — 🚨 CORRIGIR HOJE
- **O que é**: Supabase Auth aceita senhas que apareceram em data breaches.
- **Custo**: Zero para ativar (toggle no Dashboard).
- **Risco**: Credential stuffing → comprometimento de contas admin → acesso a dados de múltiplos tenants.
- **Como corrigir**: Dashboard > Auth > Settings > Enable "Leaked password protection"

### DX-02: Sentry instalado mas NÃO configurado — 🚨 CORRIGIR ESTA SEMANA
- **O que é**: `@sentry/react` está no package.json mas sem inicialização.
- **Custo**: ~2 horas de trabalho.
- **Risco**: Erros em produção são invisíveis. Sem stack traces, sem alertas.
- **Como corrigir**: Adicionar `Sentry.init()` em `main.tsx` com DSN. Adicionar Error Boundary no App.

### DX-03: `wa_webhook_events` com bloat 63:1 — 🚨 CORRIGIR ESTA SEMANA
- **O que é**: 52MB de espaço para 824KB de dados reais.
- **Custo**: 5 minutos de SQL.
- **Risco**: Performance de webhook processing degradada. Crescimento exponencial.
- **Como corrigir**:
  ```sql
  -- CUIDADO: VACUUM FULL adquire lock exclusivo. Executar em horário de baixa.
  VACUUM FULL wa_webhook_events;
  REINDEX TABLE CONCURRENTLY wa_webhook_events;
  -- Repetir para solar_market_proposals (ratio 593:1)
  VACUUM FULL solar_market_proposals;
  REINDEX TABLE CONCURRENTLY solar_market_proposals;
  ```
