# 📊 Relatório de Observabilidade — OBSERVABILITY_STATUS.md

**Data:** 2026-02-09  
**Escopo:** Edge Functions, Webhooks, WhatsApp, Uploads, Exceções  
**Stack:** Supabase Edge Functions (Deno) + Sentry (frontend)

---

## 1. Resumo

| Área | Status | Cobertura |
|------|--------|-----------|
| Frontend (Sentry) | ✅ Ativo | Errors + Sessions + Replay |
| Edge Functions (logs) | ✅ Funcional | console.error em todas |
| Error Handler centralizado | ✅ `errorHandler.ts` | Mapeia erros Supabase → msgs PT-BR |
| Audit Logs | ✅ Tabela `audit_logs` | Ações críticas registradas |
| WhatsApp Outbox | ⚠️ Parcial | Sem alerta de mensagens stuck |
| Webhook Events | ⚠️ Parcial | Sem retry em falhas |
| Upload failures | ⚠️ Parcial | Erro exibido, sem log persistido |
| Database Health | ❌ Ausente | Sem monitoramento de queries lentas |

---

## 2. Edge Functions — Status Individual

| Função | Logs | Error handling | Observação |
|--------|------|----------------|------------|
| `evolution-webhook` | ✅ Prefixado | ✅ try/catch | Funcional — logs recentes OK |
| `process-webhook-events` | ✅ Prefixado | ✅ try/catch | ⚠️ Logs duplicados (3x boot para 3 events) — possível race condition com múltiplas invocações |
| `process-wa-followups` | ✅ | ✅ try/catch | ⚠️ N+1 queries (loop por conversa) |
| `process-wa-outbox` | ✅ | ✅ | Funcional |
| `send-whatsapp-message` | ✅ Prefixado | ✅ | Funcional |
| `process-whatsapp-automations` | ✅ Prefixado | ✅ | Funcional |
| `webhook-lead` | ✅ | ✅ | Funcional |
| `lead-scoring` | ✅ | ✅ + fallback | Fallback quando AI falha |
| `generate-ai-insights` | ✅ | ✅ | Funcional |
| `create-tenant` | ⚠️ | ⚠️ Sem console.error | Erro retornado mas não logado |
| `instagram-sync` | ✅ | ✅ | Funcional |
| `sync-tarifas-aneel` | ✅ Prefixado | ✅ | Funcional |
| `sync-taxas-bcb` | ✅ Prefixado | ✅ | Funcional |
| `check-wa-instance-status` | ✅ | ✅ | Funcional |
| `solar-market-sync` | ✅ | ✅ | Funcional |
| `solar-market-auth` | ✅ | ✅ | Funcional |
| `solar-market-webhook` | ✅ | ✅ | Funcional |
| `migrate-storage-paths` | ✅ | ✅ | One-time migration |
| `cleanup-legacy-storage` | ✅ | ✅ | One-time cleanup |

---

## 3. Problemas Identificados

### 🔴 Crítico

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **`process-webhook-events` — invocações triplicadas** | Logs mostram 3 boots simultâneos processando os mesmos 3 events, gerando media armazenada em duplicata (mesmo PDF 3x). Possível falta de deduplicação ou lock. |
| 2 | **WhatsApp Outbox sem monitoramento de stuck** | Mensagens com status "pending" ou "sending" podem ficar presas indefinidamente sem alerta. |

### 🟡 Importante

| # | Problema | Impacto |
|---|----------|---------|
| 3 | **N+1 queries no `process-wa-followups`** | Para cada regra × cada conversa, faz query individual para última mensagem + existing followup + past attempts. Pode timeout em escala. |
| 4 | **`process-webhook-events` — media duplicada** | O mesmo arquivo PDF/audio é armazenado múltiplas vezes no Storage quando processado em paralelo. |
| 5 | **Sem retry automático em webhook failures** | Events que falham no processamento são logados mas não retentados. |
| 6 | **`create-tenant` não loga erros no console** | Falhas silenciosas — difícil debugar via logs do Supabase. |

### 🟢 Menor

| # | Problema | Impacto |
|---|----------|---------|
| 7 | **Sem dashboard de saúde do sistema** | Admin não tem visão rápida de erros recentes, mensagens não enviadas, webhooks falhando. |
| 8 | **Upload failures não persistidos** | Erros de upload são exibidos via toast mas não registrados para análise posterior. |

---

## 4. Recomendações (Sem criar stack nova)

### Prioridade 1 — Fix imediato

1. **Deduplicar processamento de webhook events** — Adicionar lock via `SELECT ... FOR UPDATE SKIP LOCKED` na query de events pendentes
2. **Adicionar `console.error` no `create-tenant`** catch block
3. **Criar query de monitoramento para outbox stuck:**
```sql
-- Mensagens WA stuck há mais de 5min
SELECT id, status, created_at, content 
FROM wa_outbox 
WHERE status IN ('pending', 'sending') 
AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at;
```

### Prioridade 2 — Melhorias

4. **Widget de saúde no Admin dashboard** — Query simples mostrando: outbox stuck, webhook errors últimas 24h, follow-ups pendentes
5. **Batch queries no `process-wa-followups`** — Substituir N+1 por joins ou batch selects

---

## 5. Métricas de Saúde Sugeridas (via queries existentes)

| Métrica | Query |
|---------|-------|
| Outbox stuck (>5min) | `SELECT COUNT(*) FROM wa_outbox WHERE status IN ('pending','sending') AND created_at < NOW() - INTERVAL '5 min'` |
| Webhook events não processados | `SELECT COUNT(*) FROM wa_webhook_events WHERE processed = false AND created_at < NOW() - INTERVAL '10 min'` |
| Follow-ups pendentes | `SELECT COUNT(*) FROM wa_followup_queue WHERE status = 'pendente'` |
| Leads sem contato (>48h) | `SELECT COUNT(*) FROM leads WHERE visto = false AND created_at < NOW() - INTERVAL '48 hours'` |
