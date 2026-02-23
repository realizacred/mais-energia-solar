# 🌱 Seed Infrastructure

**Data:** 2026-02-23

---

## RESUMO

O sistema possui uma infraestrutura completa de seed para ambiente de desenvolvimento/teste, acessível apenas por administradores via `/admin/dev`.

---

## COMPONENTES

| Componente | Localização | Função |
|---|---|---|
| `DevSeedPage` | `/admin/dev/seed` | Cria fluxo completo: Cliente → Deal → Proposta |
| `DevResetSeedPage` | `/admin/dev/reset-seed` | Preview + limpeza de dados seed |
| `DevToolsPage` | `/admin/dev` | Container com tabs Seed / Limpar Seed |

---

## RPCs NO BANCO

| Função | Tipo | Descrição |
|---|---|---|
| `get_or_create_cliente` | SECURITY INVOKER | Cria ou reutiliza cliente existente |
| `create_proposta_nativa_atomic_v2` | SECURITY INVOKER | Cria proposta + versão atomicamente |
| `preview_seed_data` | SECURITY INVOKER | Conta registros seed (read-only) |
| `delete_seed_data` | SECURITY INVOKER | Remove dados seed em ordem correta de FK |
| `require_tenant_id` | Helper | Resolve tenant do usuário autenticado |

---

## FLUXO DE SEED (Criar)

```
1. Verifica admin (is_admin RPC)
2. get_or_create_cliente("Cliente Teste", "11999990000")
3. Busca consultor ativo → owner_id
4. Busca pipeline padrão + primeiro stage
5. INSERT deal (título "Projeto Seed Teste [run:XXX]")
6. Busca projeto vinculado ao deal (trigger automático)
7. create_proposta_nativa_atomic_v2 (título "Proposta Seed Teste [run:XXX]")
8. Exibe resultado com links para navegação
```

---

## FLUXO DE LIMPEZA (Reset)

```
1. Verifica admin
2. preview_seed_data() → conta registros por tipo
3. Usuário confirma exclusão
4. delete_seed_data() → deleta em ordem de FK:
   - proposta_versoes
   - propostas_nativas
   - checklists_cliente / checklists_instalador
   - comissoes / layouts_solares / obras / os_instalacao
   - servicos_agendados / deal_activities / deal_notes
   - projetos → deals → clientes
5. Remove lastSeedRunId do localStorage
```

---

## ISOLAMENTO MULTI-TENANT

- ✅ `require_tenant_id()` usado em todas as RPCs de seed
- ✅ Todas as queries filtram por `tenant_id`
- ✅ Nenhum dado de outro tenant é acessível
- ✅ Sem hardcoded tenant IDs no código

---

## PADRÃO DE IDENTIFICAÇÃO

Dados seed são identificados por:
- Deals: `title ILIKE 'Projeto Seed%'`
- Propostas: `titulo ILIKE 'Proposta Seed%'`
- Clientes: `nome ILIKE 'Cliente Teste%' OR telefone = '11999990000'`

---

## SEGURANÇA

- Acesso restrito a `is_admin = true`
- UI verifica permissão antes de renderizar
- RPCs usam `require_tenant_id()` (sem bypass)
- Confirmação obrigatória antes da exclusão

---

## LIMITAÇÕES CONHECIDAS

1. Seed não cria leads (apenas clientes diretos)
2. Seed não cria simulações/UCs
3. Seed não popula equipamentos ou configurações
4. Não há seed para dados de WhatsApp ou agenda

Estes são aceitáveis para o escopo atual (validar fluxo crítico Cliente → Projeto → Proposta).
