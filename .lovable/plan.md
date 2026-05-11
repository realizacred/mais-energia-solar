## Auditoria — Estado atual

### 1. SSOT financeiro hoje

| Coisa | Onde nasce | Onde é lida | Conflito? |
|---|---|---|---|
| `precoFinal` (total da proposta) | `usePrecoFinal(itens, servicos, venda)` em `ProposalWizard.tsx:346` | StepPagamento, StepResumo, snapshot, validate, calcFinancialSeries | OK (SSOT único) |
| `pagamentoOpcoes[]` (plano de pagamento) | `useState` em `ProposalWizard.tsx:295` | StepPagamento, snapshot, `resolveProposalVariables`, `renderTableVariable`, PDF/web | **Plano** ≡ array plano de "opções alternativas", **não** composição. |
| `formasSelecionadas[]` (drag&drop) | `useState` em `StepPagamento.tsx:198` | reconstroi `pagamentoOpcoes` de `tipo="direto"` via effect | **Estado paralelo** ao `pagamentoOpcoes` |
| `bancoGroups[]` (financiamentos por banco) | `useState` em `StepPagamento.tsx:183` | reconstroi `pagamentoOpcoes` de `tipo="financiamento"` via effect | **Estado paralelo** ao `pagamentoOpcoes` |

### 2. Modelo `PagamentoOpcao` (types.ts:354)

```
{ id, nome, tipo, valor_financiado, entrada, taxa_mensal,
  carencia_meses, num_parcelas, valor_parcela, forma_pagamento? }
```

Premissa do schema: cada item é **uma opção independente** que cobre 100% do `precoFinal`. Não existe campo `valor_alocado`/`prioridade`/`grupo_composicao`. O cliente "escolhe uma opção" — não há composição multi-método.

### 3. Effects perigosos confirmados

| Local | Problema | Risco |
|---|---|---|
| `ProposalWizard.tsx:415-439` | Effect "sidecar" força `a_vista.entrada/valor_parcela = precoFinal` e `financiamento.valor_financiado = precoFinal` em **toda** opção sempre que `precoFinal` muda | Sobrescreve qualquer entrada manual e força "100% do total" — destrói qualquer composição |
| `StepPagamento.tsx:217-245` | Effect recalcula `valor_parcela` de cada banco com `valor_financiado = precoFinal` | Idem — assume opção = 100% |
| `StepPagamento.tsx:248-269` | Effect funde `bancoGroups + formasSelecionadas → pagamentoOpcoes` em cascata sempre que qualquer um muda; `onOpcoesChange` na dep list | Ciclo de re-render + estado triplicado (banco/formas/opcoes) |
| `StepPagamento.tsx:152-164` | `flattenBancoGroupsToOpcoes` sempre injeta `"À Vista"` default quando não há financiamento | À Vista coexiste com transferência adicionada — sintoma reportado |
| `StepPagamento.tsx:251-253` | `principal = (valor_total || precoFinal) - entrada` por item, mas `valor_total` default = `precoFinal` (linha 323) | Cada método "direto" também assume 100% do preço |

### 4. Sintomas explicados

- "À vista coexistindo": `flattenBancoGroupsToOpcoes` injeta default mesmo quando há `formasSelecionadas`.
- "Financiamento ignora entrada manual": effect `[precoFinal]` (`ProposalWizard.tsx:431`) reseta `valor_financiado = precoFinal`, ignorando `entrada` registrada por outro método.
- "Parcela não recalcula": `valor_parcela` cai junto na sobrescrita do effect sidecar.
- "Não fecha total": não existe campo `valor_alocado` nem invariante `Σ alocado = precoFinal`.

### 5. Downstream que lê o plano

- `resolveProposalVariables.ts:702-744` — variáveis `f_valor_N`, `f_entrada_N`, `vc_parcela_N` lêem direto de `pagamentoOpcoes`.
- `renderTableVariable.ts:151-157` — tabela de parcelas lê `pagamentoOpcoes[].num_parcelas/valor_parcela`.
- `validatePropostaFinal.ts:135` — só valida `length === 0`.
- Snapshot `useWizardPersistence.ts` e `ProposalWizard.tsx:866/1082/1183` — serializa/desserializa `pagamento_opcoes` 1:1.
- `normalizeSolarMarketV2.ts:280-383` — proposta SM gera **1 item** com nome/valor herdados.

---

## Arquitetura proposta

### A) SSOT canônico

Um único objeto `pagamentoPlano` (substitui `pagamentoOpcoes[]` no estado vivo do wizard, sem quebrar snapshot):

```ts
interface PagamentoPlano {
  total_proposta: number;        // espelho de precoFinal (read-only)
  itens: PagamentoItem[];
  // derivados (computed, não persistidos):
  // valor_alocado = Σ itens.valor_alocado
  // valor_restante = total_proposta - valor_alocado
  // status: "fechado" | "incompleto" | "excedente"
}

interface PagamentoItem {
  id: string;
  prioridade: number;            // ordem de cobrança (1 = primeiro)
  nome: string;                  // rótulo livre ("Sinal PIX", "Cartão 3x")
  metodo: FormaPagamento;        // pix | transferencia | cartao_credito | financiamento | …
  origem: "direto" | "financiamento" | "a_vista"; // categoria de cálculo
  valor_alocado: number;         // ★ NOVO — fatia que ESTE método cobre
  entrada: number;               // entrada DENTRO deste item (ex.: financ. com entrada própria)
  num_parcelas: number;
  taxa_mensal: number;
  carencia_meses: number;
  valor_parcela: number;         // derivado, recalculado em util único
  banco_id?: string;             // para financiamento
  forma_pagamento?: FormaPagamento; // legado, mantido = metodo
}
```

**Invariantes:**
- `Σ itens.valor_alocado === total_proposta` (validação dura).
- `entrada ≤ valor_alocado` por item.
- `valor_alocado > 0`, `taxa_mensal ≥ 0`, `num_parcelas ≥ 1`.

### B) Pipeline de cálculo (único)

```
precoFinal  →  PagamentoPlano (estado)
             ↓
    distribuirPlano(plano, precoFinal)   // util puro
             ↓
    recalcParcelas(item)                 // util puro por item
             ↓
    snapshot.pagamentoOpcoes (serialização ↓)
             ↓
    resolveProposalVariables / renderTableVariable / PDF / web
```

Tudo em utilitários puros em `src/services/paymentComposition/`. Zero `useEffect` de mutação cruzada.

### C) Compatibilidade retroativa

- **Schema do snapshot permanece `pagamento_opcoes[]`**. Adicionamos campos opcionais (`valor_alocado`, `prioridade`, `metodo`). Snapshots antigos sem esses campos são **promovidos no read** por `liftLegacyToPlano(opcoes, precoFinal)`:
  - Se 1 item: `valor_alocado = precoFinal`, `prioridade = 1`.
  - Se N itens (modelo "alternativas"): mantém como **alternativas exclusivas** num campo separado `pagamentoAlternativas[]` e cria plano vazio com 1 item À Vista cobrindo 100% (preserva exibição). Usuário pode converter em composição.
- Proposta SM: `normalizeSolarMarketV2` continua emitindo 1 item → `liftLegacyToPlano` converte automaticamente.
- Downstream (`resolveProposalVariables`, `renderTableVariable`) recebe `pagamentoOpcoes` projetado a partir do plano (mesma forma de array) — **zero mudança** em PDF/web nessa fase.

### D) UX

- Substituir tab "Pagamento" por: header com 3 KPIs (Total, Alocado, Restante) + lista vertical de `PagamentoItem` ordenada por prioridade + botão "Adicionar método" (PIX, Transferência, Cartão, Financiamento, Outro).
- Cada linha: método, valor alocado (input R$), entrada própria (se aplicável), parcelas, parcela calculada, ações (↑↓ prioridade, remover).
- Barra de progresso "Cobertura do total" com cor (verde fechado / âmbar incompleto / vermelho excedente).
- Botão "Distribuir restante neste método" para preencher rapidamente.

### E) Validações

`validatePagamentoPlano(plano)` retorna `errors[]`:
- `valor_restante !== 0` → erro bloqueante "Total não fecha".
- `Σ alocado > total_proposta` → erro "Excedente".
- Item com `valor_alocado ≤ 0` → erro.
- `entrada > valor_alocado` → erro.
- `taxa_mensal < 0` ou `num_parcelas < 1` → erro.
- `metodo === "financiamento"` sem `banco_id` → warning.

`validatePropostaFinal` passa a chamar `validatePagamentoPlano` ao invés do check de `length`.

### F) Remoção de effects perigosos

- Apaga effect sidecar (`ProposalWizard.tsx:415-439`).
- Apaga effect `[precoFinal,bancos]` que reseta `valor_financiado` em `StepPagamento.tsx:217-245`.
- Apaga effect de merge `bancoGroups + formas → opcoes` (`248-269`); merge passa a ser síncrono no handler que altera o plano.
- `precoFinal` muda → util `reconciliarPlano(plano, novoPreco)` ajusta SOMENTE se plano tem 1 item de origem "a_vista" (caso default); composições manuais permanecem intactas e exibem badge "Total mudou — revise alocação".

---

## Plano em fases (cada fase encerra com build verde)

**Fase 1 — Estabilização (zero novo recurso)**
- Remover injeção automática de "À Vista" quando há `formasSelecionadas` (`StepPagamento.tsx:152-164`).
- Trocar effect sidecar por util `reconciliarPlanoDefault` chamado só no setter de `precoFinal` quando há 1 item À Vista.
- Apagar dependência circular do effect de merge: usar handlers diretos.

**Fase 2 — Modelo canônico (interno, sem mudar UI)**
- Criar `src/services/paymentComposition/plano.ts` com `PagamentoPlano`, `PagamentoItem`, `liftLegacyToPlano`, `projectToOpcoes`, `recalcParcela`, `reconciliarPlano`.
- `ProposalWizard` passa a manter `pagamentoPlano` no estado. `pagamentoOpcoes` derivado via `useMemo(projectToOpcoes)`.
- Snapshot continua serializando array `pagamento_opcoes`; ler também `pagamento_plano` se existir (forward compat).

**Fase 3 — Compatibilidade**
- `restoreFromSnapshot` chama `liftLegacyToPlano` no read.
- Proposta SM: `normalizeSolarMarketV2` continua igual; conversor cuida.
- Smoke test: abrir 1 nativa, 1 SM antiga, 1 SM editada — todos abrem sem erro.

**Fase 4 — Nova UI de composição**
- Reescrever painel de pagamento em `StepPagamento` para `PagamentoPlanoEditor` (3 KPIs + lista + botão adicionar). Drag&drop opcional só para reordenar prioridade.
- `bancoGroups` e `formasSelecionadas` substituídos pelo plano único.

**Fase 5 — Validações**
- Adicionar `validatePagamentoPlano` em `validatePropostaFinal`. Bloquear "Gerar Proposta" se `valor_restante !== 0`.
- Toast claro com saldo restante.

**Fase 6 — Integração PDF/web**
- `resolveProposalVariables` passa a expor também `total_proposta`, `valor_alocado`, `valor_restante` e iterar por `prioridade`.
- `renderTableVariable` ganha modo "composição" (linhas = itens do plano com coluna "valor alocado").
- Garantir que templates antigos continuam renderizando via projeção `pagamentoOpcoes`.

---

## Impacto em propostas existentes

| Cenário | Comportamento |
|---|---|
| Nativa salva (1 opção À Vista) | `liftLegacyToPlano` → plano com 1 item, valor_alocado = total. Idêntico ao atual. |
| Nativa salva (N opções alternativas) | Promovida para `pagamentoAlternativas[]` (não-composição); plano gera 1 À Vista 100%. UI mostra alerta "Alternativas detectadas — converter em composição?". |
| SM migrada não editada | `normalizeSolarMarketV2` (1 item) → `liftLegacyToPlano` → plano 1 item. Snapshot importado preservado. |
| SM migrada editada | Salva snapshot novo já com `pagamento_plano` canônico + `pagamento_opcoes` projetado. PDF/web seguem lendo `pagamento_opcoes`. |
| Snapshot reaberto após Fase 4 | Lê `pagamento_plano` se houver; senão `liftLegacyToPlano(pagamento_opcoes)`. |

## Garantias

- Sem migração de schema (campos opcionais no JSON).
- Sem mudança em RPC, edge functions, Gotenberg, proposta web nas Fases 1–4.
- Cada fase é mergeável independentemente (build + tsc verde antes de seguir).
- Effects de mutação cruzada são removidos, não acumulados.

## Próximo passo (após aprovação)

Iniciar Fase 1 (estabilização) — alterações em 2 arquivos (`ProposalWizard.tsx`, `StepPagamento.tsx`), zero novo arquivo, baixo risco. Depois pausar para validação visual antes de Fase 2.