# Fase 6 — Auditoria de Fluxo Financeiro

**Data:** 2026-02-23  
**Status:** ✅ Concluída

## Tabelas Financeiras Auditadas

| Tabela | RLS | Audit Trigger | updated_at | Role |
|--------|-----|---------------|------------|------|
| `comissoes` | ✅ | ✅ `audit_log_trigger_fn` | ✅ trigger adicionado | `authenticated` |
| `pagamentos` | ✅ | ✅ `audit_log_trigger_fn` | ❌ sem coluna (design) | `authenticated` |
| `commission_plans` | ✅ | ❌ (config, não transacional) | ✅ existente | `authenticated` (fixado) |
| `proposta_versoes` | ✅ | ✅ `audit_log_trigger_fn` | ✅ trigger adicionado | `authenticated` (fixado) |
| `projetos` | ✅ | ✅ `audit_log_trigger_fn` | ✅ trigger adicionado | `authenticated` (fixado) |
| `project_events` | ✅ | N/A (é a tabela de auditoria) | N/A | `authenticated` + imutável |

## Correções Aplicadas

### 1. RLS Hardening (role public → authenticated)
- `commission_plans` — INSERT/UPDATE/DELETE agora exigem `is_admin()`
- `proposta_versoes` — todas as operações restritas a authenticated
- `projetos` — todas as operações restritas a authenticated
- `project_events` — INSERT separado para authenticated e service_role

### 2. Triggers Adicionados
- `trg_comissoes_updated_at` — BEFORE UPDATE
- `trg_proposta_versoes_updated_at` — BEFORE UPDATE
- `trg_projetos_updated_at` — BEFORE UPDATE (condicional)

### 3. Imutabilidade
- `project_events` — UPDATE(false), DELETE(false) ✅ confirmado

## Análise de Lógica Financeira

### Cálculo de Comissões
- **Frontend** calcula `valor_comissao = valor_base * percentual / 100`
- Aceitável porque: operação admin-only, cálculo determinístico, RLS protege
- **Recomendação futura:** migrar para RPC/trigger para SSOT

### Lifecycle de Comissões
- ✅ Geração automática na aceitação de proposta
- ✅ Cancelamento automático quando proposta recusada/cancelada
- ✅ Status workflow: pendente → aprovada → paga / cancelada

### Dados Protegidos
- Consultores veem apenas suas próprias comissões
- Admins têm acesso total dentro do tenant
- Nenhum dado financeiro exposto publicamente
