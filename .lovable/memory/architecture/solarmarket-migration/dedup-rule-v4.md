---
name: SM Dedup Rule V4 (locked)
description: Regra DEFINITIVA de deduplicação na migração SolarMarket — só CPF/CNPJ válido OU telefone REAL (não-placeholder). Email NUNCA dedupa.
type: constraint
---

# Dedup SolarMarket — REGRA TRAVADA com usuário

## Causa do bug histórico (corrigido)
80 clientes foram colapsados em 5 registros porque o motor `sm-promote` usava
telefones placeholder (`32999999999`, `99999999999`, etc) como chave de match.
Ex: 48 clientes diferentes (CPFs distintos) viraram 1 só "Jailton".

## Regra definitiva
Cliente SM dedupa com cliente CRM existente APENAS se:

1. **CPF/CNPJ igual** (length normalizado IN (11, 14)), **OU**
2. **Telefone REAL igual** (length 10 ou 11 E não-placeholder)

### Telefone é PLACEHOLDER quando:
- length não é 10 nem 11 dígitos
- todo dígito repetido (regex `^(\d)\1+$`)
- termina em 6+ noves ou 6+ zeros (regex `(9{6,}|0{6,})$`)
- está na lista `KNOWN_PLACEHOLDER_PHONES` (ex: `99999999999`, `00000000000`)

### Email NUNCA dedupa
Removido do fluxo. Email fica como dado, não como chave.

## Implementação canônica
- Helper `isPlaceholderPhone(digits)` em `supabase/functions/sm-promote/index.ts` (perto da linha 554)
- `normalizeSmClient` zera `telefone_digits` se placeholder antes de qualquer dedup
- Cache de chunk (`ClienteCache.byPhone`) e queries paralelas (`byPhoneRes`) automaticamente respeitam isso porque só ativam com `telefone_digits` não-vazio
- Dedup por `byEmailRes` neutralizado com `void byEmailRes`

## NUNCA mais
- ❌ Adicionar match por email
- ❌ Aceitar telefone com 6+ dígitos repetidos no final
- ❌ Reduzir a lista `KNOWN_PLACEHOLDER_PHONES`
- ❌ Mudar a ordem de prioridade: external_id > cliente_code > CPF > telefone real
