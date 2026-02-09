# Rate Limiting — Edge Functions

**Data:** 2026-02-09  
**Método:** Tabela DB com sliding window + `pg_cron` cleanup

## Arquitetura

```
Request → Edge Function → check_rate_limit() RPC → Allow/Deny (429)
                                ↓
                        edge_rate_limits table
                                ↓
                    pg_cron cleanup (*/15 min)
```

### Componentes

| Componente | Descrição |
|------------|-----------|
| `edge_rate_limits` | Tabela de contagem por função + identificador |
| `check_rate_limit()` | Função RPC: verifica e incrementa no mesmo call |
| `cleanup_edge_rate_limits()` | Remove entradas > 1 hora |
| `pg_cron` job | Executa cleanup a cada 15 minutos |

### Segurança

- Tabela com RLS ativado e **zero policies** = apenas `service_role` acessa
- Função `SECURITY DEFINER` com `search_path = 'public'`
- Identificador baseado em IP (`x-forwarded-for` / `cf-connecting-ip`)

## Limites Configurados

| Edge Function | Identificador | Window | Max Requests | Contexto |
|---------------|---------------|--------|-------------|----------|
| `webhook-lead` | IP do caller | 60s | 30 | Webhook público — protege contra flood |
| `evolution-webhook` | Instance key ou IP | 60s | 120 | Webhook Evolution — alto volume natural |
| `send-whatsapp-message` | IP do caller | 60s | 60 | Envio via API — chamadas internas frequentes |
| `process-whatsapp-automations` | IP do caller | 60s | 30 | Automações — normalmente batch |

### Rate Limiting Pré-Existente (DB Triggers)

Além do rate limiting nas edge functions, as seguintes tabelas já possuem proteção via triggers:

| Tabela | Trigger | Limite |
|--------|---------|--------|
| `leads` | `check_lead_rate_limit` | 5 inserts/telefone/hora |
| `orcamentos` | `check_orcamento_rate_limit` | 10/lead_id/hora |
| `simulacoes` | `check_simulacao_rate_limit` | 50 global/5min |

## Resposta 429

Quando o rate limit é excedido, a edge function retorna:

```json
HTTP 429 Too Many Requests
Retry-After: 60

{
  "success": false,
  "error": "Rate limit exceeded"
}
```

## Monitoramento

### Consultar contagens atuais

```sql
SELECT function_name, identifier, COUNT(*) as requests, 
       MIN(window_start) as first_request, MAX(window_start) as last_request
FROM edge_rate_limits
WHERE window_start > now() - interval '5 minutes'
GROUP BY function_name, identifier
ORDER BY requests DESC;
```

### Verificar cron job

```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-edge-rate-limits';
```

### Verificar execuções do cron

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-edge-rate-limits')
ORDER BY start_time DESC LIMIT 10;
```

## Ajustes

Para alterar limites, edite os parâmetros `_window_seconds` e `_max_requests` na chamada `check_rate_limit()` dentro de cada edge function.

Exemplo — reduzir `webhook-lead` para 10 req/min:
```typescript
const { data: allowed } = await supabaseRL.rpc("check_rate_limit", {
  _function_name: "webhook-lead",
  _identifier: identifier,
  _window_seconds: 60,
  _max_requests: 10, // ← ajustado
});
```

## Extensões Futuras

- **Redis (Upstash)**: Migrar para Upstash Redis se o volume superar ~1000 req/min (custo da tabela DB cresce)
- **Per-tenant limits**: Adicionar `tenant_id` ao identificador para limites por tenant
- **Dashboard admin**: Widget com contagens de rate limit em tempo real
