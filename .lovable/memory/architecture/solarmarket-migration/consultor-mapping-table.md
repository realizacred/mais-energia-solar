---
name: SM Consultor Mapping Table
description: sm_consultor_mapping table replaces hardcoded VENDEDOR_MAP in migrate-sm-proposals-v2 edge function
type: feature
---
A tabela `sm_consultor_mapping` substitui o `VENDEDOR_MAP` hardcoded na edge function de migração SM.

**Estrutura:**
- `sm_name` (text): nome do vendedor no SolarMarket (normalizado)
- `canonical_name` (text): nome canônico do consultor no sistema nativo
- `consultor_id` (uuid, nullable): link direto para `consultores.id` se conhecido
- `is_ex_funcionario` (boolean): se true, mapeia para "Escritório" automaticamente

**Lógica de fallback:** Se a tabela estiver vazia para o tenant, a edge function usa defaults hardcoded (backward compatible).

**RLS:** Isolamento por tenant via `get_user_tenant_id()`.

**Nota importante:** No sistema nativo, não existem "vendedores" — apenas "consultores". A tabela mapeia nomes do SM (que usa o conceito de vendedor/funil de vendedores) para consultores nativos.
