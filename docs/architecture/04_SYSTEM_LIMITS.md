# 4 — LIMITES DO SISTEMA

> **Propósito**: Declarar explicitamente onde o sistema quebra.
> **Atualizar**: Após testes de carga ou incidentes.

---

## 4.1 — Limites de Capacidade

| Recurso | Limite Teórico | Limite Real Estimado | Gargalo |
|---------|---------------|---------------------|---------|
| **Tenants ativos** | Ilimitado (RLS) | ~200 | Postgres connections + noisy neighbor |
| **Usuários concurrent** | PgBouncer pool (~500 conn) | ~2.000 | Connection pool exhaustion |
| **Webhooks/hora** | Ilimitado (tabela) | ~10.000 | Advisory lock serialization + VACUUM pressure |
| **Mensagens WA/hora** | Ilimitado (tabela) | ~50.000 | wa_messages INSERT rate + Realtime fanout |
| **Realtime channels** | ~10.000 (Supabase) | ~500 concurrent | Channel fanout + server memory |
| **Edge Function concurrent** | ~100 (Supabase) | ~50 | Cold start + 60s timeout |
| **Storage per tenant** | Bucket limits | ~10GB | Supabase plan limits |
| **MV refresh time** | Depende de dados | <5s com <100k rows | Lock duration durante REFRESH |

---

## 4.2 — Pontos de Quebra por Escala

### Com 10 tenants (ATUAL)
✅ Sistema funciona bem. Bloat em `wa_webhook_events` é a única anomalia visível.

### Com 50 tenants
⚠️ **Primeiros sinais de stress**:
- Dashboard MVs levam mais tempo para refresh
- Connection pool começa a saturar em horários de pico
- Realtime channels se aproximam do limite prático
- Cleanup jobs de pg_cron podem começar a sobrecarregar

### Com 200 tenants
🔴 **Degradação significativa**:
- Postgres começa a recusar conexões em picos
- `wa_webhook_events` bloat atinge GBs
- Queries de `get_super_admin_metrics` (que faz COUNT em leads, profiles, clientes por tenant) se tornam lentas
- Realtime começa a dropar conexões silenciosamente

### Com 1.000 tenants
💀 **Sistema inoperável sem redesenho**:
- Postgres único não suporta a carga de reads + writes
- `wa_messages` sem partição = scans em bilhões de rows
- `audit_logs` sem partição = impossível de consultar
- Edge Functions com cold start = timeout em cascata
- SPA bundle size cresce com features = slow load

### Com 10.000+ tenants
💀💀 **Impossível na arquitetura atual**. Necessário:
- Read replicas (mínimo 2)
- Sharding por tenant range ou geográfico
- Queue externo (SQS/Redis Streams)
- CDN + edge caching
- Kubernetes ou serverless com auto-scaling real

---

## 4.3 — Gargalos Específicos

### Gargalo 1: Advisory Lock no Webhook Processing
```
wa_webhook_events INSERT → pg_try_advisory_lock → process batch → release
```
- **Throughput**: 1 worker por vez (by design, para idempotência)
- **Limite**: Se processamento de 1 batch leva 5s, throughput máximo = 12 batches/min
- **Mitigação**: Batch size ajustável, mas limitado pelo wall-clock de 60s da Edge Function

### Gargalo 2: `get_super_admin_metrics` RPC
```sql
LEFT JOIN LATERAL (SELECT COUNT(*)::int FROM leads WHERE tenant_id = t.id) lc ON true
LEFT JOIN LATERAL (SELECT COUNT(*)::int FROM profiles WHERE tenant_id = t.id) pc ON true
LEFT JOIN LATERAL (SELECT COUNT(*)::int FROM clientes WHERE tenant_id = t.id) cc ON true
```
- **Complexidade**: O(tenants × 3 COUNTs) por página
- **Limite**: Com 1000 tenants, mesmo paginado, os COUNTs individuais são caros
- **Mitigação futura**: Counter caching ou approximate COUNT

### Gargalo 3: Realtime Fanout
```
wa_conversations UPDATE → Realtime → N canais (1 por usuário com Inbox aberto)
```
- **Throughput**: Cada update gera N notificações WebSocket
- **Limite**: Com 100 usuários no Inbox = 100 notificações por mensagem
- **Mitigação existente**: Filtro por `tenant_id` no canal reduz fanout cross-tenant

### Gargalo 4: Supabase Auth Token Refresh
- **Mecanismo**: JWT expira a cada hora. Refresh token é usado automaticamente.
- **Limite**: Em operações batch (sync, upload múltiplo), token pode expirar mid-operation
- **Mitigação existente**: `refreshSession()` antes de uploads críticos

---

## 4.4 — Limites Teóricos vs Reais

| Dimensão | Teórico (Postgres) | Real (Supabase Pro) | Real (Este Sistema) |
|----------|-------------------|--------------------|--------------------|
| Connections | 10.000+ | ~500 (PgBouncer) | ~200 (pool sharing) |
| Rows/table | Bilhões | Bilhões | ~10M antes de degradação (sem partição) |
| Queries/sec | 100.000+ | ~5.000 (estimado) | ~1.000 (RLS overhead) |
| Write throughput | 50.000 TPS | ~2.000 TPS | ~500 TPS (triggers + RLS + audit) |
| Realtime events/sec | N/A | ~1.000 | ~200 (fanout × channels) |
