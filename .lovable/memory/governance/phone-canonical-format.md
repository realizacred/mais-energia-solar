---
name: Telefone canônico para gravação
description: Toda gravação de telefone_normalized (leads, clientes, etc) usa toCanonicalPhoneDigits — celular sempre 11 dígitos com 9º, fixo 10. Rejeita placeholders.
type: constraint
---

# Formato canônico de telefone_normalized

## Regra
Toda escrita em `telefone_normalized` (qualquer tabela) DEVE passar por
`toCanonicalPhoneDigits()` — SSOT em `src/utils/phone/toCanonicalPhoneDigits.ts`.

- Celular (DDD + 8 dígitos começando com 8/9) → adiciona o 9º dígito → 11 dígitos
- Fixo (DDD + 8 dígitos começando com 2-7) → mantém 10 dígitos
- DDI 55 é removido
- Placeholders (todos repetidos, 6+ noves/zeros no fim, lista conhecida) → null
- Tamanho fora de [10,11] após DDD → null

## Pontos de gravação cobertos
- `supabase/functions/public-create-lead/index.ts` (cópia local do helper para Deno)
- `src/components/admin/leads/ImportarLeadsModal.tsx`
- `src/hooks/useVendedorPortal.ts`
- `supabase/functions/sm-promote/index.ts` (já tem normalização própria com placeholder rules)

## Por quê
Leads salvos com 10 dígitos (formato antigo) não casavam com clientes migrados
do SolarMarket que sempre vêm com 11 dígitos (com 9º). Match exato falhava em
17 leads (53% dos órfãos). Backfill aplicado em 2026-04-30 via migration.

## Não fazer
- ❌ `telefone.replace(/\D/g, "")` direto em campo persistido
- ❌ `phoneDigits.slice(-11)` (mantém 10 se entrar 10)
- ❌ Gravar `telefone_normalized: null` em INSERT de novo lead — sempre tentar `toCanonicalPhoneDigits` primeiro
