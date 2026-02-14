# 3 — MAPA DE RISCOS ARQUITETURAIS

> **Classificação**: CRÍTICO (sistema para) | ALTO (degradação severa) | MÉDIO (degradação parcial)
> **Atualizar**: A cada sprint ou incidente.

---

## CRÍTICO

### R01 — Postgres único sem read replicas
- **Mecanismo**: Todas as reads (dashboard, inbox, super admin, analytics) e writes (webhooks, mensagens, leads) competem pelo mesmo nó Postgres.
- **Gatilho**: Volume de reads analíticas (MVs, dashboards de admin, Super Admin listando tenants) somado a writes contínuas (webhooks, outbox, follow-ups).
- **Impacto em escala**: Com 50+ tenants ativos, queries de dashboard podem bloquear writes de webhook, causando backlog crescente. Com 200+ tenants, connection pool esgota.
- **Evidência atual**: Latência ainda aceitável (poucos tenants), mas `wa_webhook_events` com 52MB de bloat indica VACUUM pressure.

### R02 — Noisy neighbor (sem resource isolation per-tenant)
- **Mecanismo**: Um tenant com volume desproporcional (ex: 100k mensagens/dia) consome capacidade compartilhada de CPU, I/O e connections.
- **Gatilho**: Tenant enterprise com múltiplas instâncias WhatsApp de alto volume.
- **Impacto em escala**: Todos os outros tenants sofrem latência aumentada. Sem mecanismo de throttling per-tenant.
- **Mitigação inexistente**: Rate limiting atual é por `function_name + identifier`, não por `tenant_id`.

### R03 — `wa_webhook_events` bloat (52MB para 824KB dados)
- **Mecanismo**: INSERT → process → DELETE em loop contínuo gera dead tuples. VACUUM não consegue reclamar espaço rápido o suficiente. Índices crescem monotonicamente.
- **Gatilho**: Volume sustentado de webhooks > capacidade de VACUUM.
- **Impacto em escala**: Index scans degradam. Disk I/O aumenta. Queries que buscam "unprocessed events" ficam lentas.
- **Ação imediata**: `VACUUM FULL wa_webhook_events` + `REINDEX TABLE CONCURRENTLY wa_webhook_events` + considerar partição temporal.

### R04 — Zero observabilidade real
- **Mecanismo**: `console.log("[ALERT]")` em Edge Functions sem receptor. Sentry instalado mas não configurado. Nenhum APM, nenhuma métrica, nenhum dashboard operacional.
- **Gatilho**: Qualquer falha silenciosa (webhook parado, cron não executando, Realtime desconectado).
- **Impacto em escala**: Problemas podem persistir por horas/dias sem detecção. Sem SLA mensurável.

---

## ALTO

### R05 — `select("*")` epidêmico (68 arquivos)
- **Mecanismo**: Transfere todas as colunas de todas as tabelas consultadas. Impede index-only scans. Acopla frontend ao schema completo.
- **Gatilho**: Schema change (ADD/DROP/RENAME column) em tabela consultada.
- **Impacto em escala**: Tráfego de rede desnecessário multiplicado por número de usuários. Cada query transfere bytes extras × frequência × users.

### R06 — Vendor lock-in total (Supabase)
- **Mecanismo**: Auth, DB, Storage, Realtime, Edge Functions, cron — tudo num único provider. Zero abstração.
- **Gatilho**: Mudança de pricing, deprecação de feature, outage prolongado, ou necessidade de infra customizada.
- **Impacto em escala**: Migração exige rewrite de 100% do backend + 54 arquivos frontend + 50 Edge Functions.

### R07 — Leaked password protection desativada
- **Mecanismo**: Supabase Auth aceita senhas que apareceram em data breaches públicos.
- **Gatilho**: Atacante com lista de credenciais vazadas tenta login em massa.
- **Impacto em escala**: Comprometimento de contas de admin/vendedor → acesso a dados de clientes de múltiplos tenants.

### R08 — `resolve_public_tenant_id()` com fallback single-tenant
- **Mecanismo**: Função assume exatamente 1 tenant ativo. Com 2+, lança exceção. Inserções anônimas param.
- **Gatilho**: Segundo tenant ser marcado como `ativo = true`.
- **Impacto em escala**: Todos os formulários públicos (leads, orçamentos, simulações) param de funcionar para TODOS os tenants.

### R09 — MV refresh sem CONCURRENTLY
- **Mecanismo**: `REFRESH MATERIALIZED VIEW extensions.mv_financeiro_resumo` (sem CONCURRENTLY) adquire lock exclusivo durante refresh.
- **Gatilho**: Refresh coincide com queries de dashboard.
- **Impacto em escala**: Queries ao dashboard financeiro bloqueiam por duração do refresh (segundos a minutos com dados grandes).

### R10 — Rate limiting não segmentado por tenant
- **Mecanismo**: `check_rate_limit(_function_name, _identifier)` usa identifier genérico (IP). Um tenant pode consumir toda a cota.
- **Gatilho**: Tenant com script automatizado ou uso intenso de API.
- **Impacto em escala**: Outros tenants são bloqueados por rate limit atingido por tenant abusivo.

### R11 — 50 Edge Functions sem shared auth module
- **Mecanismo**: Cada função reimplementa: criação de client, validação de auth, resolução de tenant. Zero DRY.
- **Gatilho**: Bug em validação de auth em UMA função = acesso service_role ao banco inteiro.
- **Impacto em escala**: Superfície de ataque de 50 endpoints. Cada um é potencial privilege escalation.

### R12 — Frontend como camada de dados (sem abstração)
- **Mecanismo**: 522 queries Supabase diretas em 54 componentes React. Sem repository/service layer.
- **Gatilho**: Qualquer schema migration.
- **Impacto em escala**: Custo de manutenção cresce linearmente. Risco de regressão a cada deploy.

### R13 — Sem testes automatizados
- **Mecanismo**: Nenhum teste unitário, integração ou E2E visível no projeto.
- **Gatilho**: Qualquer refactor ou feature nova.
- **Impacto em escala**: Regressões silenciosas. Bugs descobertos apenas por usuários em produção.

---

## MÉDIO

### R14 — Realtime sem heartbeat/fallback
- **Mecanismo**: WebSocket disconnect silencioso = dados stale no frontend sem detecção.
- **Gatilho**: Instabilidade de rede do usuário, Supabase Realtime maintenance, firewall corporativo.
- **Impacto em escala**: Vendedores perdem mensagens novas. Inbox mostra dados desatualizados.

### R15 — `audit_logs` sem índice em `tenant_id`
- **Mecanismo**: Queries de auditoria por tenant fazem seq scan.
- **Gatilho**: Super Admin consultando audit de tenant específico.
- **Impacto em escala**: Com milhões de registros, query timeout.

### R16 — `solar_market_proposals` bloat patológico (ratio 593:1)
- **Mecanismo**: 19MB total para 32KB de dados reais. Provável sync loop criando/deletando registros.
- **Gatilho**: Sync com SolarMarket API.
- **Impacto em escala**: Disk space e I/O desperdiçados. Não bloqueia operação mas indica problema no sync.

### R17 — Cold start de Edge Functions
- **Mecanismo**: Deno Edge Functions sofrem cold start após inatividade (~1-3s).
- **Gatilho**: Primeiro request após período idle.
- **Impacto em escala**: UX degradada para operações que chamam Edge Functions (health check, send message, AI actions).
