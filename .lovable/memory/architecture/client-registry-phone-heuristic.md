---
name: Phone is heuristic, not identity
description: Telefone do cliente é busca/sugestão; o índice único foi removido. Família, empresa e responsável podem compartilhar telefone.
type: constraint
---
Telefone NÃO é identidade rígida do cliente. Domínio comercial brasileiro permite reuso (família, empresa, responsável).

Regras:
- `clientes.telefone_normalized` tem apenas índice de busca `idx_clientes_tenant_telefone_normalized` (NÃO unique). O antigo `uq_clientes_tenant_telefone` foi removido.
- Identidade rígida ainda é: `external_id` (por origem), `cpf_cnpj`, `cliente_code`.
- UI de criação DEVE mostrar "telefone já usado por…" com opções "reutilizar" / "criar novo mesmo assim".
- Dedup automático por telefone só reconcilia quando `nameSimilarity >= 0.6`. Abaixo disso: criar novo cliente.
- `sm-promote` NÃO joga manual_review por phone_collision_diff_name; cria novo registro normalmente.
- `sm_manual_review` segue existindo para outros conflitos (CPF, code), não para telefone puro.

**Why:** Bloqueio por telefone causou 2.170 PROMOTE_FAILED em propostas SM (74, 89, 884, 925) e UX ruim em famílias/empresas no CRM nativo.
