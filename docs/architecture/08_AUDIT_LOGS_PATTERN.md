# 8 — PADRÃO OBRIGATÓRIO: AUDITORIA VIA TRIGGERS

> **Status**: PERMANENTE. Complementa R03 (07_IMMUTABLE_RULES.md).
> **Última validação**: 2026-03-25
> **Contexto**: Após remoção de INSERTs diretos em `proposal_delete` e `proposal_update_status`.

---

## Regra Principal

**`audit_logs` é preenchido EXCLUSIVAMENTE por triggers autorizados.**

A tabela possui um gatilho de segurança (`guard_audit_log_insert`) que bloqueia
qualquer `INSERT` que não tenha a flag de sessão `app.audit_trigger_active = 'true'`.

### ✅ PERMITIDO

| Método | Exemplo |
|--------|---------|
| Trigger com `set_config('app.audit_trigger_active', 'true', true)` | `audit_propostas_nativas`, `audit_log_trigger_fn` |
| `proposal_events` para trilha funcional complementar | `INSERT INTO proposal_events (...)` |

### ❌ PROIBIDO

| Método | Exemplo |
|--------|---------|
| INSERT direto em RPC | `INSERT INTO audit_logs (...)` dentro de `proposal_delete` |
| INSERT direto em Edge Function | `supabase.from("audit_logs").insert(...)` |
| INSERT via frontend | `supabase.from("audit_logs").insert(...)` em `src/` |

---

## Checklist para Novas RPCs de Proposta

Antes de criar ou modificar uma RPC que altera `propostas_nativas` ou `proposta_versoes`:

- [ ] A RPC faz `UPDATE`/`INSERT`/`DELETE` na tabela principal?
- [ ] O trigger `audit_propostas_nativas` (ou equivalente) já cobre essa tabela?
- [ ] A RPC **NÃO** contém `INSERT INTO audit_logs`?
- [ ] Se necessário, a RPC registra em `proposal_events` (trilha funcional)?
- [ ] O `EXCEPTION WHEN OTHERS THEN NULL` protege o insert em `proposal_events`?

---

## Checklist para Novas RPCs de Qualquer Módulo

- [ ] A tabela alvo possui trigger de auditoria (`audit_log_trigger_fn`)?
- [ ] Se sim: **NÃO** inserir em `audit_logs` manualmente
- [ ] Se não: criar trigger com `set_config('app.audit_trigger_active', 'true', true)` antes do INSERT
- [ ] Edge Functions: **NÃO** usar `.from("audit_logs").insert()` — usar tabelas de log dedicadas do módulo

---

## Violações Conhecidas (Dívida Técnica)

As seguintes Edge Functions ainda fazem `.from("audit_logs").insert()` diretamente.
Estes inserts **falharão** se o `guard_audit_log_insert` estiver ativo, pois o
client JS não define a session variable `app.audit_trigger_active`.

| Edge Function | Arquivo | Status |
|---------------|---------|--------|
| `growatt-api` | `supabase/functions/growatt-api/index.ts` | ⚠️ Pendente |
| `monitoring-sync` | `supabase/functions/monitoring-sync/index.ts` | ⚠️ Pendente |
| `monitoring-connect` | `supabase/functions/monitoring-connect/index.ts` | ⚠️ Pendente |
| `billing-create-checkout` | `supabase/functions/billing-create-checkout/index.ts` | ⚠️ Pendente |
| `facebook-lead-webhook` | `supabase/functions/facebook-lead-webhook/index.ts` | ⚠️ Pendente |

### Estratégia de Remediação (Sprint Futura)

1. Criar tabela de log dedicada por módulo (ex: `monitoring_audit_log`, `billing_audit_log`) ou
2. Criar RPC `audit_log_insert(...)` com `SECURITY DEFINER` que define a session variable internamente
3. Substituir `.from("audit_logs").insert()` pela alternativa escolhida
4. Testar que `guard_audit_log_insert` não bloqueia

---

## RPCs de Proposta — Estado Validado (2026-03-25)

| RPC | INSERT audit_logs? | Trigger ativo? | proposal_events? |
|-----|-------------------|----------------|-------------------|
| `proposal_create` | ❌ Removido | ✅ `audit_propostas_nativas` | ✅ |
| `proposal_create_version` | ❌ Removido | ✅ `audit_propostas_nativas` | ✅ |
| `proposal_update_status` | ❌ Removido | ✅ `audit_propostas_nativas` | ✅ |
| `proposal_delete` | ❌ Removido | ✅ `audit_propostas_nativas` | ✅ |
| `proposal_clone` | ❌ Removido | ✅ `audit_propostas_nativas` | ✅ |
| `proposal_list` | N/A (read-only) | N/A | N/A |

---

## Referência: Como Funciona o Guard

```sql
-- Trigger: guard_audit_log_insert (BEFORE INSERT on audit_logs)
-- Bloqueia INSERT a menos que app.audit_trigger_active = 'true'
-- Triggers autorizados fazem:
PERFORM set_config('app.audit_trigger_active', 'true', true);
INSERT INTO audit_logs (...);
-- A flag é transacional (true = local to transaction)
```
