---
name: SM Migration is 1:1 (NO dedup by phone/CPF/email)
description: Migração SolarMarket é 1:1. Identidade do cliente migrado é apenas external_entity_links (source=solarmarket, source_entity_type=cliente, source_entity_id=sm_client_id). Telefone/CPF/email NÃO deduplicam.
type: constraint
---

# Migração SolarMarket — 1:1 (regra travada com usuário)

A migração NÃO faz deduplicação inteligente. Cada `sm_clientes_raw` vira UM cliente próprio no CRM, salvo se já houver `external_entity_links` para o mesmo `sm_client_id`.

## Identidade da migração
- `source = solarmarket`
- `source_entity_type = cliente`
- `source_entity_id = sm_client_id`
- `tenant_id`

## Ordem de lookup em `promoteCliente` (sm-promote)
1. `findLink(...)` por external_entity_links → reutiliza
2. Cache do chunk apenas por `external_id` / `cliente_code`
3. SELECT em `clientes` apenas por `external_id` (LEGACY_SM_SOURCES) ou `cliente_code` (`SM-{id}`)
4. Caso contrário: INSERT novo cliente + upsertLink

## NUNCA fazer
- ❌ Buscar/reutilizar cliente CRM por telefone, CPF/CNPJ ou email
- ❌ Quarentenar (`sm_manual_review`) por `phone_collision_diff_name`
- ❌ Usar `nameSimilarity` para decidir reuso de cliente
- ❌ Vincular `cliente.lead_id` automaticamente por telefone
- ❌ Race recovery por telefone/CPF/email (apenas external_id e cliente_code)

## Telefone
Telefone fica gravado (`telefone`, `telefone_normalized`) apenas para busca/exibição. Não é unique e não dedupa. Família, empresa e responsável compartilham livremente.

## Manual review
`sm_manual_review` segue existindo APENAS para conflitos reais de link/payload — nunca para telefone/CPF/email repetidos.

**Why:** Usuário pediu migração 1:1 explícita. Dedup por telefone causou colapso histórico de clientes (ex.: 48 CPFs distintos virando 1 "Jailton") e travamento de propostas 74/89/884/925.
