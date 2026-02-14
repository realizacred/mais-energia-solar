# 2 — ARCHITECTURAL DECISION RECORDS (ADR)

> **Formato**: Lightweight ADR (LADR)
> **Convenção**: Decisões numeradas, imutáveis após aprovação. Status: ACCEPTED | SUPERSEDED | OPEN.

---

## ADR-001: Supabase como plataforma única
**Status**: ACCEPTED (fundação)

**Contexto**: Necessidade de time-to-market rápido com auth, banco, storage, realtime e edge functions integrados.

**Decisão**: Adotar Supabase como plataforma exclusiva para todo o backend.

**Alternativas consideradas**:
1. AWS (Cognito + RDS + Lambda + SQS) — maior controle, 10x mais complexo
2. Firebase + Cloud SQL — vendor lock-in similar, menos controle sobre Postgres
3. Self-hosted Supabase — controle total, custo operacional alto

**Riscos aceitos**:
- Vendor lock-in total. Migração = rewrite de 100% do backend.
- Limites de conexão, Realtime, e Edge Functions ditados pelo provider.
- Sem controle sobre PgBouncer, read replicas, ou infra de rede.

**Impacto futuro**: Se Supabase mudar pricing, deprecar features, ou sofrer outage prolongado, o sistema fica 100% refém. Não há plano B.

---

## ADR-002: Isolamento multi-tenant via shared schema + RLS
**Status**: ACCEPTED (fundação)

**Contexto**: Necessidade de isolar dados entre empresas (tenants) em um banco Postgres compartilhado.

**Decisão**: Todas as 140 tabelas possuem `tenant_id NOT NULL` com RLS policies que filtram por `get_user_tenant_id()`.

**Alternativas consideradas**:
1. Schema-per-tenant — isolamento forte, operacionalmente insustentável com 1000+ tenants
2. Database-per-tenant — isolamento máximo, custo proibitivo no Supabase
3. Shared schema com RLS — escolhido. Escalável, mas depende de RLS correto em 100% dos paths

**Riscos aceitos**:
- RLS bypass em Edge Functions com `service_role` — mitigado por validação explícita de `tenant_id`
- Performance degradada com muitos tenants em tabelas hot — mitigado por índices compostos `(tenant_id, ...)`
- Noisy neighbor: um tenant com alto volume afeta todos — NÃO mitigado

**Impacto futuro**: Com 1000+ tenants, tabelas como `wa_messages` e `leads` precisarão de particionamento por `tenant_id` ou range temporal.

---

## ADR-003: Postgres como fila de mensagens (webhook queue)
**Status**: ACCEPTED (com ressalvas)

**Contexto**: Webhooks da Evolution API precisam ser processados de forma idempotente e resiliente.

**Decisão**: Usar tabela `wa_webhook_events` como fila + advisory lock para processamento serializado.

**Alternativas consideradas**:
1. Redis Streams — performance superior, mas infra adicional fora do Supabase
2. AWS SQS — escalável, mas acoplamento externo e latência de integração
3. Supabase Queues (beta) — não maduro na época da decisão

**Riscos aceitos**:
- **Bloat**: Tabela já apresenta ratio 63:1 (52MB total vs 824KB dados). Dead tuples e índices inchados.
- **Serialização**: Advisory lock = throughput limitado a ~1 worker por vez
- **Cleanup**: pg_cron deleta processados após 7 dias, mas não faz REINDEX

**Impacto futuro**: Com volume de 10k+ webhooks/hora, latência de processamento cresce não-linearmente. Necessário migrar para queue externo ou Supabase Queues quando maduro.

---

## ADR-004: Frontend como camada de acesso a dados (sem API layer)
**Status**: ACCEPTED (dívida reconhecida)

**Contexto**: Supabase JS SDK permite queries diretas do frontend com RLS protegendo os dados.

**Decisão**: 522 queries diretas em 54 arquivos React, sem camada intermediária (repository/service).

**Alternativas consideradas**:
1. API layer (Edge Functions como proxy) — overhead de latência e manutenção
2. Repository pattern no frontend — melhor abstração, refactor significativo
3. GraphQL layer — complexidade adicional sem benefício claro

**Riscos aceitos**:
- Schema change quebra potencialmente 54 arquivos
- `select("*")` em 68 arquivos = coupling máximo com schema
- Sem type-safety runtime (queries são strings)

**Impacto futuro**: Cada migration exige varredura manual de 54+ arquivos. Custo de manutenção cresce linearmente com features.

---

## ADR-005: Realtime como única fonte de freshness (sem polling)
**Status**: ACCEPTED

**Contexto**: Evitar query storms causadas por polling redundante.

**Decisão**: Supabase Realtime (WebSocket) como único mecanismo de atualização para Inbox, conversas e notifications. Polling proibido.

**Alternativas consideradas**:
1. Polling com intervalo longo (60s) — previsível mas wasteful
2. Polling + Realtime — proibido por política (causa storms)
3. Realtime only — escolhido

**Riscos aceitos**:
- WebSocket disconnect silencioso = dados stale sem detecção
- Supabase Realtime tem limite de ~200 canais concurrent por projeto
- Sem heartbeat ou fallback automático

**Impacto futuro**: Com 500+ usuários concurrent, Realtime pode dropar conexões sem notificação. Necessário implementar heartbeat + fallback polling com backoff.

---

## ADR-006: Materialized Views para dashboards analíticos
**Status**: ACCEPTED (com bug conhecido)

**Contexto**: Queries analíticas (leads por mês, pipeline, financeiro) são pesadas e não podem competir com OLTP.

**Decisão**: 5 materialized views refreshadas por pg_cron.

**Riscos aceitos**:
- Dados stale entre refreshes (aceitável para dashboards)
- **BUG**: `mv_financeiro_resumo` usa `REFRESH MATERIALIZED VIEW` sem `CONCURRENTLY` = bloqueia reads durante refresh

**Impacto futuro**: Com crescimento de dados, refresh time aumenta. Necessário monitorar duração e considerar refresh incremental.

---

## ADR-OPEN-001: Estratégia de caching
**Status**: OPEN (não decidido)

**Contexto**: Zero caching hoje. Toda request vai ao Postgres.

**Opções**:
1. Supabase Edge Functions com cache em memória (efêmero, cold start zera)
2. Cloudflare Workers KV como cache layer
3. Redis externo (Upstash) — mais controle, custo adicional
4. CDN para assets estáticos + SWR no frontend

**Recomendação**: Redis externo (Upstash) para dados hot (tenant config, plan limits, consultor lookup). CDN para assets. SWR no frontend para dados pouco voláteis.

---

## ADR-OPEN-002: Particionamento de tabelas de alto volume
**Status**: OPEN (não decidido)

**Contexto**: `wa_messages`, `wa_webhook_events`, `audit_logs` crescem indefinidamente sem partição.

**Opções**:
1. Partição por range temporal (mês/trimestre) — operacionalmente simples
2. Partição por `tenant_id` — melhor isolation, mais complexo
3. Partição composta (tenant_id + mês) — ideal mas complexo no Supabase
4. Archival para cold storage — simples, perde queryability

**Recomendação**: Partição por range temporal (mensal) para `wa_messages` e `audit_logs`. Archival + delete para `wa_webhook_events` (dados transientes).

---

## ADR-OPEN-003: Observabilidade
**Status**: OPEN (não decidido)

**Contexto**: Sentry instalado mas não configurado. Zero métricas, zero tracing, zero alerting funcional.

**Opções**:
1. Sentry (já instalado) para errors + Supabase Dashboard para logs
2. Sentry + Grafana Cloud para métricas custom
3. Datadog full stack — custo alto, cobertura total
4. Sentry + PgHero para DB monitoring

**Recomendação**: Sentry configurado (P0) + Grafana Cloud free tier para métricas essenciais.

---

## ADR-OPEN-004: Migração de `resolve_public_tenant_id`
**Status**: OPEN (risco ativo)

**Contexto**: Função assume que existe exatamente 1 tenant ativo. Com 2+, inserções anônimas param.

**Opções**:
1. Exigir `consultor_code` ou `tenant_slug` em todos os forms públicos — breaking change
2. Manter fallback mas limitar a plano Enterprise — complexo
3. Resolver via domínio customizado (hostname → tenant) — robusto mas requer DNS

**Recomendação**: Opção 1 (exigir código de consultor) + Opção 3 (domain-based resolution) como evolução.
