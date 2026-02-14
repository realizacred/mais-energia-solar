# 5 — RUNBOOK DE SOBREVIVÊNCIA

> **Propósito**: Guias operacionais para cenários de crise.
> **Audiência**: SREs, DevOps, engenheiros de plantão.
> **Regra**: Passos claros, sem ambiguidade. Assume acesso ao Supabase Dashboard.

---

## 5.1 — Banco de Dados Fora / Lento

### Sintomas
- Frontend mostra erros de timeout
- Edge Functions retornam 500/503
- Supabase Dashboard > Database > Connection Pooling mostra 100% usage

### Diagnóstico
1. Verificar status do Supabase: https://status.supabase.com
2. Dashboard > Database > Logs: procurar "too many connections" ou "deadlock detected"
3. Dashboard > Database > Query Performance: identificar queries lentas

### Ação imediata
1. **Se connection pool esgotado**:
   - Dashboard > Database > Extensions: verificar se pg_cron jobs estão rodando em paralelo
   - Matar queries lentas:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'active' AND query_start < now() - interval '30 seconds'
   AND query NOT LIKE '%pg_stat%';
   ```

2. **Se bloat excessivo**:
   ```sql
   -- Verificar bloat
   SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) as size,
          pg_size_pretty(pg_relation_size(oid)) as data_size
   FROM pg_class WHERE relnamespace = 'public'::regnamespace
   ORDER BY pg_total_relation_size(oid) DESC LIMIT 20;
   
   -- VACUUM emergencial (não bloqueia, mas pode ser lento)
   VACUUM (VERBOSE) wa_webhook_events;
   VACUUM (VERBOSE) wa_messages;
   ```

3. **Se deadlock**:
   ```sql
   SELECT * FROM pg_locks WHERE NOT granted;
   -- Identificar e matar o processo bloqueador
   ```

### Prevenção
- Monitorar `pg_stat_activity` diariamente
- Configurar alertas para connection count > 80%
- VACUUM ANALYZE automático via pg_cron (já configurado para tabelas hot)

---

## 5.2 — Supabase Cloud Indisponível (Outage Total)

### Sintomas
- SPA carrega mas mostra "Failed to fetch" em todas operações
- Auth não funciona (login/signup falham)
- https://status.supabase.com reporta incidente

### Ação imediata
1. **NÃO FAZER NADA DESTRUTIVO**. Aguardar resolução do provider.
2. Comunicar usuários via canal externo (email, WhatsApp direto) sobre indisponibilidade
3. Verificar se PWA offline está cacheando dados locais (Dexie DB):
   - Leads capturados offline serão sincronizados quando voltar
   - Checklists offline serão enviados quando voltar

### Após recuperação
1. Verificar integridade:
   ```sql
   -- Webhooks pendentes acumulados
   SELECT COUNT(*) FROM wa_webhook_events WHERE processed = false;
   
   -- Follow-ups que não rodaram
   SELECT COUNT(*) FROM wa_followup_queue WHERE status = 'pendente';
   
   -- Dead letter queue
   SELECT COUNT(*), type FROM dead_letter_queue WHERE status = 'pending' GROUP BY type;
   ```
2. Forçar reprocessamento de webhooks pendentes (Edge Function `process-webhook-events` via invoke manual)
3. Forçar refresh de MVs:
   ```sql
   SELECT refresh_dashboard_views();
   ```

### Prevenção
- Manter PWA com Service Worker atualizado para cache offline
- Considerar DNS failover para página de status estática

---

## 5.3 — Pico Extremo de Tráfego

### Sintomas
- Latência de queries > 5s
- Edge Functions com timeout (504)
- Realtime desconecta frequentemente

### Diagnóstico
```sql
-- Queries ativas
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Top queries por duração
SELECT query, state, now() - query_start as duration
FROM pg_stat_activity WHERE state = 'active'
ORDER BY duration DESC LIMIT 10;
```

### Ação imediata
1. **Desabilitar MVs refresh temporariamente**:
   ```sql
   -- Comentar no pg_cron ou ajustar frequência
   SELECT cron.unschedule('refresh-dashboard-views');
   ```

2. **Desabilitar workers não-críticos**:
   - Follow-ups podem esperar
   - AI insights podem esperar
   - Sync SolarMarket pode esperar

3. **Reduzir Realtime fanout**: Se possível, desligar subscriptions não-essenciais temporariamente

4. **Limitar connections por Edge Function**: Cada invocação abre 1-2 connections. Se 50 funções rodando = 100 connections consumidas.

### Prevenção
- Implementar circuit breaker em Edge Functions
- Rate limiting per-tenant (não existe hoje)
- Cache layer (Redis/KV) para dados hot

---

## 5.4 — Deploy Desastroso (SPA ou Edge Function)

### Sintomas (SPA)
- Tela branca após deploy
- Console mostra "ChunkLoadError" ou "Failed to fetch dynamically imported module"

### Ação imediata (SPA)
1. Rollback via Lovable: reverter ao commit anterior
2. Se Lovable indisponível: o deploy anterior está cached no CDN, aguardar purge ou forçar via Supabase

### Sintomas (Edge Function)
- Função retorna 500 após deploy
- Logs mostram "TypeError" ou "ReferenceError"

### Ação imediata (Edge Function)
1. Verificar logs: Dashboard > Edge Functions > [function] > Logs
2. Redeploy da versão anterior:
   ```bash
   supabase functions deploy [function-name]
   ```
3. Se a função é crítica (`evolution-webhook`, `process-webhook-events`):
   - Webhooks vão acumular em `wa_webhook_events`
   - Após fix, reprocessar batch manualmente
4. Se a função é não-crítica (`ai-conversation-summary`, `generate-ai-insights`):
   - Sistema continua operando sem ela
   - Fix pode esperar

### Prevenção
- Nunca deployar todas as 50 Edge Functions de uma vez
- Deploy incremental: teste individual → staging → production
- Edge Functions críticas devem ter testes automatizados

---

## 5.5 — Suspeita de Vazamento de Dados

### Sintomas
- Usuário reporta ver dados de outro tenant
- Logs mostram queries sem filtro de `tenant_id`
- Super Admin actions com `target_tenant_id` inconsistente

### Ação imediata
1. **ISOLAR**: Suspender o tenant afetado via Super Admin
2. **INVESTIGAR**:
   ```sql
   -- Verificar se há queries sem tenant_id em RLS
   SELECT tablename, policyname, qual 
   FROM pg_policies 
   WHERE schemaname = 'public' AND qual NOT LIKE '%tenant%';
   
   -- Verificar audit trail recente
   SELECT * FROM super_admin_actions 
   ORDER BY created_at DESC LIMIT 50;
   
   -- Verificar se há dados cross-tenant
   SELECT DISTINCT tenant_id, COUNT(*) 
   FROM leads 
   GROUP BY tenant_id 
   ORDER BY COUNT(*) DESC;
   ```

3. **CONTER**: Se vazamento confirmado:
   - Desativar RLS bypass (se algum) imediatamente
   - Revogar tokens de todos os usuários do tenant afetado
   - Documentar scope do vazamento (quais dados, quais tenants, timeframe)

4. **COMUNICAR**: Notificar tenants afetados conforme LGPD/GDPR

### Prevenção
- Security scan periódico via `supabase--linter`
- Code review obrigatório para qualquer mudança em RLS ou Edge Functions
- Testes de isolamento (query com token do tenant A deve NUNCA retornar dados do tenant B)

---

## 5.6 — Webhook Storm (Evolution API)

### Sintomas
- `wa_webhook_events` com milhares de registros `processed = false`
- Edge Function `process-webhook-events` em timeout
- Advisory lock impedindo processamento

### Diagnóstico
```sql
-- Backlog atual
SELECT COUNT(*), MIN(created_at) as oldest_pending
FROM wa_webhook_events WHERE processed = false;

-- Lock status
SELECT * FROM pg_locks WHERE locktype = 'advisory';
```

### Ação imediata
1. Se lock está preso:
   ```sql
   -- Liberar advisory lock manualmente
   SELECT pg_advisory_unlock(hashtext('process-webhook-events'));
   ```
2. Processar em batches menores (invocar Edge Function manualmente via curl)
3. Se volume > capacidade:
   ```sql
   -- Marcar eventos muito antigos como falha (> 1 hora sem processar)
   UPDATE wa_webhook_events 
   SET processed = true, retry_count = 99
   WHERE processed = false AND created_at < now() - interval '1 hour';
   ```
4. Após estabilizar, verificar dead_letter_queue para reprocessamento

### Prevenção
- Alert quando backlog > 100 eventos não-processados
- Rate limiting no endpoint de webhook
- Circuit breaker na Evolution API connection
