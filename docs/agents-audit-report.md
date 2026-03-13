# AGENTS.md Audit Report

**Generated**: 2026-03-13
**Baseline status**: Lote 1 remediation applied

---

## Lote 1 — Aplicado (esta sessão)

### Correções aplicadas
| Arquivo | Problema | Correção |
|---------|----------|----------|
| `StepDocumento.tsx` | Chamada duplicada `supabase.functions.invoke("proposal-send")` sem `x-client-timeout` | Substituído por `sendProposal()` de `proposalApi.ts` (centralizado, com timeout) |
| `StepDocumento.tsx` | Queries inline para templates (useEffect + supabase.from) | Extraídas para `useProposalTemplates.ts` com `staleTime: 15min` |
| `StepDocumento.tsx` | 8x `<button>` nativos | Substituídos por `Button` do shadcn |
| `StepDocumento.tsx` | `bg-success ... text-white` e `bg-info ... text-white` hardcoded | Substituído por `variant="success"` e `variant="outline" border-info text-info` |
| `useWizardPersistence.ts` | Já conforme: `sanitizeSnapshot`, `normalizeGrupo`, sem `mapSnapshots` | ✅ Validado |
| `proposalApi.ts` | Já conforme: `x-client-timeout: "120"` em generate/render/send | ✅ Validado |

### Novos artefatos
- `src/hooks/useProposalTemplates.ts` — hook centralizado com `staleTime`
- `scripts/audit-agents.mjs` — scanner de conformidade com 3 níveis de severidade

---

## Lote 2 — Próxima sprint (estimativa: 4-6h)

### Prioridade: ALTO
| Categoria | Estimativa de ocorrências | Impacto |
|-----------|---------------------------|---------|
| `useQuery` em componentes (§16) | ~66 arquivos | Mover para hooks dedicados |
| `<button>` nativos restantes (§22) | ~20-30 ocorrências | Substituir por Button shadcn |
| Queries sem `staleTime` (§23) | ~15-20 ocorrências | Adicionar staleTime adequado |
| `supabase.from()` em componentes | ~40 arquivos | Mover para hooks/services |

### Estratégia de remediação
1. Priorizar por área funcional (proposta > admin > vendor)
2. Agrupar queries do mesmo domínio em hooks compartilhados
3. Criar hooks genéricos quando padrão se repetir (ex: `useCrudQuery`)

---

## Lote 3 — Sprint seguinte (estimativa: 3-4h)

### Prioridade: MÉDIO
| Categoria | Estimativa | Impacto |
|-----------|------------|---------|
| `max-w-*` em páginas admin (§21) | ~5-8 ocorrências | Remover restrições de largura |
| `container mx-auto` em admin | ~3-5 ocorrências | Substituir por `w-full` |
| Cores hardcoded residuais (§1) | ~10-15 ocorrências | Migrar para tokens semânticos |
| `bg-white` restantes (§2) | ~5-8 ocorrências | Substituir por `bg-card` |
| Inputs nativos para telefone/CPF (§13) | ~3-5 ocorrências | Usar componentes especializados |

---

## Riscos conhecidos

1. **ToolbarButton** em `StepDocumento.tsx` usa `document.execCommand()` que é deprecated — funcional mas deveria ser migrado para biblioteca de rich text (Tiptap, Slate) em sprint futura.
2. **PropostaPublica.tsx** faz `supabase.functions.invoke("proposal-decision-notify")` fire-and-forget — aceitável pois é página pública sem hook context.
3. **66 arquivos com useQuery em componentes** — remediação gradual recomendada, não big-bang.

---

## Como executar o audit

```bash
node scripts/audit-agents.mjs
```

O script escaneia `src/` e reporta violações em 3 níveis:
- 🚫 **BLOQUEANTE** — cores hardcoded, `<button>` nativo, `bg-white`, missing `staleTime`
- ⚠️ **ALTO** — queries em componentes, supabase direto em componentes
- 💡 **MÉDIO** — `max-w-*` em admin, `container mx-auto`
