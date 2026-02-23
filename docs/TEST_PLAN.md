# 🧪 Plano de Testes Automatizados

**Data:** 2026-02-23  
**Stack:** Vitest + React Testing Library (frontend) · Deno.test (Edge Functions)

---

## 1. Estratégia

| Camada | Framework | Foco |
|--------|-----------|------|
| **Unit** | Vitest | Utils, formatação, cálculos, validações |
| **Component** | Vitest + RTL | Componentes críticos de UI (formulários, dialogs) |
| **Integration** | Vitest + MSW | Hooks com Supabase (mock de queries) |
| **Edge Function** | Deno.test | Validação I/O, auth, tenant isolation |
| **E2E (futuro)** | Playwright | Fluxos completos (smoke tests) |

---

## 2. Cobertura Mínima por Domínio

### 🔴 P0 — Crítico (cobertura obrigatória)

| Domínio | Arquivo/Hook | Testes |
|---------|-------------|--------|
| Tenant Resolution | `useAuth`, `useUserPermissions` | Retorna tenant_id correto; bloqueia sem tenant |
| Propostas | `usePropostas`, cálculo de valores | Cria proposta; calcula total; versiona |
| Leads | `useLeads` | CRUD completo; filtra por tenant |
| Clientes | Conversão lead→cliente | Copia dados; cria projeto |
| Comissões | Cálculo de comissão | Aplica percentual; respeita plano |
| Formatação | `formatCPF`, `formatPhone`, `formatBRL` | Máscara correta; edge cases |
| RLS/Auth | Edge Functions | Rejeita sem token; isola tenant |

### 🟠 P1 — Alto

| Domínio | Testes |
|---------|--------|
| WhatsApp | Envio de mensagem; webhook processing |
| Calendário | Criação de agendamento; sync status |
| Simulações | Cálculo de economia; geração de PDF |
| Checklists | Progresso; validação de campos obrigatórios |
| Dashboard | Métricas agregadas; filtros de período |

### 🟡 P2 — Médio

| Domínio | Testes |
|---------|--------|
| Gamificação | Pontuação; conquistas |
| Acessibilidade | Navegação por teclado; ARIA labels |
| Dark mode | Tokens aplicados corretamente |
| Responsividade | Layout em 375px |

---

## 3. Convenções

```
src/
  utils/__tests__/          → testes de utils
  hooks/__tests__/          → testes de hooks
  components/**/*.test.tsx  → testes de componentes
supabase/functions/
  <fn-name>/*.test.ts       → testes de Edge Functions
```

### Padrões
- Arquivos: `*.test.ts` ou `*.test.tsx`
- Naming: `describe("NomeModulo")` → `it("deve fazer X quando Y")`
- Mocks: Supabase client mockado via factory em `src/test/mocks/`
- Assertions: `expect()` do Vitest + matchers do jest-dom

---

## 4. Scripts

```bash
bun run test           # Roda todos os testes
bun run test:watch     # Watch mode
bun run test -- --coverage  # Com cobertura
```

---

## 5. Métricas Alvo

| Métrica | Alvo Fase 9 | Alvo Final |
|---------|-------------|------------|
| Testes P0 | ✅ 100% | 100% |
| Testes P1 | 50% | 100% |
| Testes P2 | 0% | 80% |
| Cobertura linhas | 20% | 60% |
| Tempo total < | 30s | 60s |
