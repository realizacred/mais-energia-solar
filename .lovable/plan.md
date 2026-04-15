

# Plano: Permitir deletar o funil "Comercial" vazio

## Problema
O código tem uma proteção hardcoded que impede desativar/deletar o funil "Comercial" (`useProjetoPipeline.ts`, linha 474). O funil atualmente tem **0 projetos** e apenas 4 etapas genéricas, mas não pode ser removido.

Além disso, o `onDeletePipeline` em `ProjetosManager.tsx` apenas chama `toggleFunilAtivo(id, false)` — ou seja, desativa em vez de deletar de verdade.

## Dados atuais do funil
- **ID:** `42c215c2-7bee-47c9-a296-f4ab033a531a`
- **Projetos vinculados:** 0
- **Etapas:** Novo, Em Andamento, Ganho, Perdido

## Correção (2 alterações mínimas)

### 1. `src/hooks/useProjetoPipeline.ts` — Relaxar proteção
Alterar a lógica de proteção para permitir desativação/deleção quando o funil "Comercial" não tem projetos vinculados. Antes de bloquear, verificar se há projetos no funil. Se estiver vazio, permitir a operação.

### 2. `src/components/admin/projetos/ProjetosManager.tsx` — Deletar de verdade
Alterar o `onDeletePipeline` para efetivamente deletar o funil (etapas + registro) em vez de apenas desativar, seguindo o padrão já existente em `useDealPipeline.ts` (`deletePipeline`). Criar uma função `deleteFunil` no hook que:
1. Deleta as `projeto_etapas` do funil
2. Deleta o registro em `projeto_funis`
3. Atualiza o estado local

## Impacto
- Alteração em 2 arquivos apenas
- Sem risco: funil tem 0 projetos
- Comportamento existente preservado para funis com projetos

