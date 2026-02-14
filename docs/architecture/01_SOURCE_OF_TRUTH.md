# 1 — ARCHITECTURE SOURCE OF TRUTH

> **Classificação**: Documento canônico. Fonte única de verdade arquitetural.
> **Audiência**: Principal Engineers, Staff Engineers, Arquitetos, SREs.
> **Atualização obrigatória**: A cada mudança estrutural.

---

## 1.1 — Visão Arquitetural

### Estilo
Monolito Supabase: Single-Page Application (React/Vite) + Edge Functions (Deno) + PostgreSQL único.

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS (SPA)                        │
│  React 18 + Vite + TanStack Query + Supabase JS SDK    │
│  522 queries diretas ao banco em 54 arquivos            │
└──────────┬──────────────────────────┬───────────────────┘
           │ PostgREST (RLS)         │ Edge Functions (50)
           ▼                         ▼
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE PLATFORM                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Auth     │ │ Realtime │ │ Storage  │ │ pg_cron    │ │
│  │ (GoTrue) │ │ (WS)    │ │ (S3)     │ │ (scheduler)│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           PostgreSQL 15 (SINGLE NODE)             │   │
│  │  140 tabelas │ 5 MVs │ 60+ functions │ RLS 100%  │   │
│  │  PgBouncer (connection pooling)                   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│  External Services   │
│  Evolution API (WA)  │
│  OpenAI / Gemini     │
│  SolarMarket API     │
│  Google Calendar     │
│  BCB (taxas)         │
│  ANEEL (tarifas)     │
└──────────────────────┘
```

### Modelo de Dados
- **140 tabelas** no schema `public`
- **5 materialized views** no schema `extensions` (dashboards)
- **60+ database functions** (SECURITY DEFINER para bypass seguro de RLS)
- **100% das tabelas com RLS ativo**
- **100% das tabelas transacionais com `tenant_id NOT NULL`**

### Multi-Tenancy
Modelo de **isolamento lógico em banco compartilhado** (shared database, shared schema).
- Cada linha possui `tenant_id` referenciando `tenants.id`
- RLS policies filtram por `get_user_tenant_id()` (SECURITY DEFINER)
- Storage paths prefixados com `{tenant_id}/`
- Edge Functions resolvem tenant via JWT ou parâmetro explícito

### Processamento Assíncrono
- **pg_cron** como scheduler (follow-ups, cleanup, health checks, MV refresh)
- **Advisory locks** (`pg_try_advisory_lock`) para serialização de workers
- **`wa_webhook_events`** como fila de entrada (tabela Postgres como queue)
- **`wa_outbox`** como fila de saída
- **`dead_letter_queue`** para retries de falhas

---

## 1.2 — Princípios Arquiteturais

| # | Princípio | Status |
|---|-----------|--------|
| P1 | **Tenant isolation end-to-end**: RLS + Edge + Frontend | ✅ Implementado |
| P2 | **Audit-first**: Toda mutação sensível gera registro imutável | ✅ Implementado |
| P3 | **Anti-fragilidade**: Sistema sobrevive a falhas parciais | ⚠️ Parcial — fallbacks existem mas sem observabilidade |
| P4 | **Source of truth única por domínio** | ✅ Implementado |
| P5 | **Sem N+1 em paths quentes** | ⚠️ Parcial — RPCs agregadas existem, mas `select("*")` é epidêmico |
| P6 | **Rate limiting em endpoints públicos** | ✅ Implementado (DB-level sliding window) |
| P7 | **Realtime como fonte de freshness, não polling** | ✅ Implementado (com debounce 500ms) |

---

## 1.3 — Restrições Arquiteturais

### Restrições impostas pelo provider (Supabase)
1. **Sem read replicas configuráveis** no plano atual
2. **Edge Functions**: timeout de 60s, cold start variável, sem estado persistente
3. **Realtime**: limite de canais por projeto (~200 concurrent channels recomendado)
4. **PgBouncer**: modo transaction por default, incompatível com prepared statements
5. **Migrations**: síncronas, sem blue-green. ALTER TABLE em tabelas grandes = lock
6. **Storage**: RLS baseada em paths, sem CDN customizável

### Restrições auto-impostas
1. **Nunca `SELECT *` em paths quentes** (violado em 68 arquivos — DÍVIDA)
2. **Nunca polling + Realtime no mesmo recurso**
3. **Nunca INSERT direto em `audit_logs`** (apenas via trigger com `app.audit_trigger_active`)
4. **Nunca role sem `tenant_id`** (enforced em `user_roles`)
5. **Nunca `assigned_to` em payloads de automação** (regra de integridade de conversas)

---

## 1.4 — Trade-offs Aceitos

### T1: Supabase como plataforma única
- **Ganho**: Velocidade de desenvolvimento, auth/storage/realtime integrados
- **Custo**: Vendor lock-in total. Migração = rewrite completo
- **Mitigação**: Nenhuma hoje. Risco aceito conscientemente.

### T2: Postgres como fila de mensagens
- **Ganho**: Simplicidade operacional, sem infra adicional (Redis/SQS)
- **Custo**: Bloat inevitável, VACUUM pressure, latência crescente sob carga
- **Mitigação**: Cleanup via pg_cron, advisory locks, dead letter queue
- **Limite**: ~10k mensagens/hora antes de degradação perceptível

### T3: Frontend como camada de dados
- **Ganho**: Desenvolvimento rápido, sem API layer intermediária
- **Custo**: 522 queries diretas em 54 arquivos. Schema change = varredura massiva
- **Mitigação**: Nenhuma hoje. DÍVIDA PERIGOSA.

### T4: Monolito de Edge Functions
- **Ganho**: Deploy independente por função
- **Custo**: 50 funções sem shared modules. Auth validation duplicada 49x.
- **Mitigação**: Nenhuma hoje. DÍVIDA ACEITÁVEL a curto prazo.

### T5: Materialized Views para dashboards
- **Ganho**: Queries analíticas não competem com OLTP em tempo real
- **Custo**: Dados stale entre refreshes. `mv_financeiro_resumo` sem CONCURRENTLY = locks
- **Mitigação**: Parcial. Algumas MVs usam CONCURRENTLY, outras não.

---

## 1.5 — Decisões Já Tomadas (Irreversíveis)

| Decisão | Data | Impacto | Reversibilidade |
|---------|------|---------|-----------------|
| Supabase como plataforma | Fundação | Total | Impossível sem rewrite |
| Shared-schema multi-tenancy | Fundação | Total | Impossível (seria migrar para schema-per-tenant) |
| React SPA (não SSR) | Fundação | Alto | Possível mas custoso |
| RLS como enforcement primário | Fundação | Total | Correto, manter |
| pg_cron como scheduler | Fase 1 | Médio | Substituível por external cron |
| Evolution API para WhatsApp | Fase 1 | Alto | Substituível com adapter |

---

## 1.6 — Decisões Perigosas Ativas

### D1: `resolve_public_tenant_id()` como fallback
**Perigo**: Com 2+ tenants ativos, inserções anônimas (leads via site) PARAM com exceção.
**Impacto**: Single point of failure para captura de leads.
**Ação necessária**: Exigir tenant context explícito em TODOS os cenários anônimos.

### D2: `select("*")` em 68 arquivos
**Perigo**: Transfere colunas desnecessárias, impede index-only scans, acopla frontend ao schema completo.
**Impacto**: Performance degradada + fragilidade a schema changes.
**Ação necessária**: Migração progressiva para seleção explícita de colunas.

### D3: Client-side filtering em `useWaConversations` (vendor mode)
**Perigo**: RLS dá acesso admin completo. Filtering é feito em JavaScript após fetch.
**Impacto**: Se o frontend falhar no filter, dados de outros vendedores vazam.
**Ação necessária**: Mover para RPC server-side com SECURITY DEFINER.

### D4: Leaked password protection desativada
**Perigo**: Senhas comprometidas em data breaches são aceitas.
**Impacto**: Credential stuffing attacks.
**Ação necessária**: Ativar no Supabase Dashboard > Auth > Security.

### D5: Zero observabilidade real
**Perigo**: Problemas silenciosos por horas/dias. `[ALERT]` em console.log sem receptor.
**Impacto**: SLA inexistente na prática.
**Ação necessária**: Sentry (já instalado, não configurado) + structured logging.
