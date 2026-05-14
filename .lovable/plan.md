# Realtime Domain Architecture — Mais Energia Solar CRM

> Status: **DESENHO**. Nada vai para código até este documento ser aprovado.
> Escopo: arquitetura de sincronização multiusuário, não patch de subscription.

---

## 0. Diagnóstico do estado atual

### Sintomas observados
- Subscriptions espalhadas em hooks de tela (cada tab abre canal próprio).
- Invalidações ad-hoc por mutation, sem dono claro.
- Badges/contadores divergem entre header, sidebar, kanban.
- Necessidade de F5 para ver estado real após ação de outro usuário.
- Race conditions em mutations concorrentes.
- Fan-out: ProjetoDetalhe abre ~6–9 canais (proposta, documentos, mensagens, financeiro, custom fields, kit, UCs).

### Causa raiz arquitetural
Hoje o sistema mistura três coisas:
1. **Estado persistido** (Supabase) — única fonte real.
2. **Cache de query** (React Query) — SSOT do servidor *no cliente*.
3. **Estado derivado** (badges, contadores, KPIs) — calculado em N lugares diferentes.

Sem fronteira clara entre os três, qualquer mutação vira "quem invalida o quê?". A correção não é mais subscriptions — é **definir owners e canais por domínio**.

---

## 1. Classificação de entidades por necessidade de realtime

### Crítico (latência < 2s, multiusuário ativo)
- **Mensagens WhatsApp/conversa** — chat ao vivo.
- **Atribuição de lead/oportunidade** — corrida entre consultores.
- **Status de proposta** (sent/accepted/rejected) — gatilho de ação imediata.
- **Locks de edição** (proposta sendo editada por outro).
- **Notificações pessoais** (sino).

### Importante (latência < 10s, colaborativo)
- **Kanban comercial e operacional** — cards movem para outros vendo.
- **Custom fields / documentos do projeto** — vários usuários no mesmo deal.
- **Checklist de instalação** — equipe campo + escritório.
- **Pagamentos recebidos / ledger financeiro** — visibilidade gerencial.
- **Assinatura digital** (status do provedor).

### Opcional (eventual, polling-on-focus aceita)
- **Dashboards/KPIs agregados** — invalidate on focus + intervalo > 60s.
- **Catálogo de kits/equipamentos** — raro mudar.
- **Configurações de funil/templates** — admin-only.
- **Concessionária / tarifas** — raríssimo.
- **Estoque** (se entrar) — depende do volume; provavelmente importante.
- **Logs de auditoria / migração SM** — opcional, on-demand.

### Nunca realtime
- Snapshots imutáveis (proposta congelada, eventos de domínio).
- Relatórios pesados (carregar sob demanda).

---

## 2. Unidade canônica de sincronização — DECISÃO

### Avaliação das opções

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| Por tabela | Simples no Supabase | Fan-out gigante, vaza esquema, frontend acopla a DDL | ❌ |
| Por tenant | 1 canal por user | Volume enorme, sem filtro útil, vaza dados | ❌ |
| Por projeto/deal | Foco por contexto | N canais por usuário ativo, mas controlado | ✅ contexto |
| Por aggregate (domínio) | Mapeia ao modelo de eventos | Requer event bus interno | ✅ base |
| Event bus interno | Desacopla origem de canal | Custo de implementação | ✅ obrigatório |

### Decisão arquitetural

**Modelo híbrido em 2 camadas:**

1. **Camada de domínio (event bus interno, server-side):** toda mutação relevante grava um *domain event* (envelope versionado, ver §3). Eventos são a SSOT do "o que aconteceu".

2. **Camada de transporte realtime (Supabase Broadcast):** canais nomeados por **escopo de contexto**, não por tabela. Cada canal carrega *projection-change notifications* (UI-safe), não payload bruto.

### Catálogo de canais (fechado)

```text
tenant:{tenant_id}:notifications        — sino global do usuário
tenant:{tenant_id}:assignments          — atribuições de lead/owner
tenant:{tenant_id}:kanban:{pipeline_id} — movimentos no board
deal:{deal_id}                          — tudo do deal (proposta, docs, custom fields, financeiro)
project:{project_id}                    — execução, instalação, checklist
conversation:{conversation_id}          — chat WhatsApp ativo
user:{user_id}:presence                 — locks de edição, presença
```

**Regras:**
- Cliente assina **só os canais do contexto atual**: ao abrir DealDetalhe, assina `deal:{id}` + `tenant:{tenant_id}:notifications`. Sai da tela = unsubscribe síncrono.
- Listas (kanban) assinam `tenant:{tenant_id}:kanban:{pipeline_id}`, **não** N canais de cada deal.
- Server publica **um evento** no canal certo após `domain_events.insert`. Frontend nunca lê `postgres_changes` diretamente.

---

## 3. Domain event envelope (transporte realtime)

```text
{
  v: 1,                          // versão do envelope
  event: "deal.proposal.accepted",
  aggregate: { type, id },
  tenant_id,
  occurred_at,
  correlation_id,
  affects: [                     // hint p/ invalidação no cliente
    { scope: "deal", id },
    { scope: "kanban", pipeline_id }
  ],
  // SEM payload de negócio sensível
}
```

Cliente recebe → consulta tabela de roteamento (§8) → invalida só as queries afetadas.

---

## 4. SSOTs duplicadas — mapa atual e correção

### Mapa de duplicação detectado

| Estado | Quem deriva hoje (errado) | Quem deve ser dono |
|---|---|---|
| Badge "propostas pendentes" | Header lê count A, sidebar lê count B, dashboard outro | Projection `deal_summary.proposals_pending` |
| Badge "documentos faltantes" | Tab Custom Fields conta, header conta separado | Projection `deal_summary.docs_missing` |
| Status do deal no card kanban | Kanban deriva de `deals.status` cru | Projection `deal_kanban_card` (já existe parcialmente) |
| Total proposta (R$) | 6 lugares calculam | `getCanonicalProposalTotal` (já é SSOT — auditar callers) |
| Lock "alguém editando" | Não existe — race silenciosa | Channel `deal:{id}` + presence track |
| Contadores de funil | Cada componente faz `count(*)` | Projection `pipeline_stage_counts` |
| KPIs dashboard | Query direto em deals/projetos | Projections `dashboard_*` materializadas |

### Princípio de correção
**Toda contagem/derivação na UI vira projection no banco.** Frontend só *lê* projection e *invalida* via canal.

---

## 5. Ownership — perguntas respondidas

| Pergunta | Resposta |
|---|---|
| Quem é dono do estado do projeto? | Aggregate `Project` no banco. Cache cliente: query `useProject(id)`. |
| Quem é dono dos badges? | Projection `deal_summary` / `project_summary`. Frontend só lê. |
| Quem é dono do lifecycle? | Workflow engine (estado persistido em `workflow_instances`). Status na tabela é *cache* da projeção. |
| Quem pode invalidar quem? | Só o **owner hook** do scope (ex: `useDealRealtime` invalida queries `deal:*`). Componentes nunca chamam `invalidateQueries` direto. |
| O que é derived state? | Tudo que pode ser recomputado de outro estado. Vai para projection ou `useMemo` local. |
| O que é persisted state? | Tabelas raiz (`deals`, `proposals_native`, `projects`, ...). |
| O que é aggregate state? | Composição de aggregate root + filhos imutáveis (ex: Proposal + versões + kits). Cache: 1 query por aggregate root. |

---

## 6. Fan-out e custo

### Estimativa atual (ProjetoDetalhe aberto)
- 6–9 `postgres_changes` subscriptions por tela aberta.
- 1 conexão Supabase Realtime por usuário (correto — multiplexa canais).
- Em tenant com 30 usuários ativos × 8 canais cada = ~240 subscriptions concorrentes.
- Cada `UPDATE` em `deals` faz fan-out para todos os assinantes da tabela, mesmo sem afetar.

### Após nova arquitetura
- 2–3 canais por tela (deal/project + notifications + presence).
- Server publica **só nos canais afetados** (filtro semântico, não por tabela).
- 30 usuários × 3 canais = 90 subscriptions, com payload pequeno (só envelope).
- Custo Supabase Realtime cai ~60%.

### Limites operacionais
- Hard cap: max 5 canais simultâneos por aba.
- Idle disconnect: canal sem evento por 10min → pausa, reconecta on focus.
- Backpressure: se cliente recebe > 50 eventos/min num canal, faz coalesce (1 invalidate por janela de 500ms).

---

## 7. Storms, loops, races — estratégias

### Anti-storm (cascata de invalidações)
- **Coalesce window** de 500ms por scope: múltiplos eventos no mesmo canal viram 1 invalidate.
- Projections **idempotentes**: mesmo evento aplicado 2× = mesmo estado.
- Server agrupa publishes em transação: 1 commit = 1 publish por canal afetado, não N.

### Anti-loop (echo de optimistic updates)
- Toda mutation carrega `client_request_id` (uuid).
- Server inclui `originator_request_id` no envelope do evento.
- Cliente ignora eventos cujo `originator_request_id` está em sua *pending mutations table* (já aplicou otimisticamente).

### Anti-race (concurrent edits)
- Aggregate version (`aggregate_version`) em toda mutation: server rejeita se versão desatualizada.
- UI mostra conflito: "outro usuário alterou — recarregar".
- Locks colaborativos via presence: ao focar campo, broadcast `editing:{field}`. Outros usuários veem indicador, podem optar por esperar.

### Anti-fanout
- Canal nunca por tabela. Sempre por contexto (§2).
- Listas grandes (kanban) usam **1 canal de pipeline**, não N de deals.
- Subscription só enquanto componente montado. Cleanup síncrono no unmount.

### Anti-cache-duplication
- 1 query key por aggregate root. Subqueries não criam cache paralelo.
- `select` no React Query para derivar projeções leves no cliente sem nova query.
- Counters/badges leem `deal_summary` projection — nunca `count(*)` no cliente.

---

## 8. Estratégia de invalidação

### Roteador de invalidação (cliente)

Tabela única em `src/realtime/invalidationMap.ts`:

```text
event                          → query keys a invalidar
deal.proposal.accepted         → ["deal", id], ["kanban", pipeline_id], ["deal-summary", id]
deal.document.uploaded         → ["deal", id, "documents"], ["deal-summary", id]
project.installation.completed → ["project", id], ["project-summary", id]
conversation.message.received  → ["conversation", id], ["notifications"]
```

- **Único hook global** `useRealtimeRouter()` montado uma vez no shell autenticado.
- Componentes nunca chamam `invalidateQueries` em response a realtime — só o router faz.
- Mutations locais usam `setQueryData` (otimista) + dependem do echo do server para confirmar.

### Hierarquia de invalidação
```text
aggregate-level invalidate  →  invalida todas as queries do aggregate
summary-level invalidate    →  invalida só projeção de badges
list-level invalidate       →  invalida lista contendo o item
```

Server escolhe o nível mínimo necessário no campo `affects` do envelope.

---

## 9. Optimistic updates

### Regras
- Permitido em: mutations curtas e idempotentes (toggle, atribuição, status simples).
- **Proibido** em: criação de aggregate, escrita financeira, transição de workflow.
- Padrão: `mutationFn` recebe `client_request_id`, retorna server state, `onMutate` faz `setQueryData`, `onSettled` confia no echo do realtime para reconciliar.
- Conflito: server retorna 409 com versão atual → cliente reverte e mostra toast.

---

## 10. Badges e contadores — desenho final

### Tabelas de projection (resumos)
```text
deal_summary           (deal_id, proposals_pending, docs_missing, last_activity_at, ...)
project_summary        (project_id, tasks_pending, days_to_install, ...)
pipeline_stage_counts  (tenant_id, pipeline_id, stage_id, count, value_sum)
user_inbox_summary     (user_id, unread_messages, pending_assignments, ...)
```

### Princípios
- Atualizadas por trigger ou projector após domain event.
- Header/sidebar/kanban leem **a mesma projection**. Zero divergência.
- Realtime: canal correspondente publica `summary.updated` → invalida só essa key.
- Recompute completo é seguro (idempotente) — usado em rebuild.

---

## 11. Mapa visual

```text
┌──────────────── Mutation (UI) ─────────────────┐
│ mutationFn → POST /api → server transaction:   │
│   1. apply change                              │
│   2. INSERT domain_event                       │
│   3. UPDATE projections (mesma TX)             │
│   4. NOTIFY broadcast(channel, envelope)       │
└────────────────────────┬───────────────────────┘
                         │
                         ▼
   ┌─────────────────────────────────────────┐
   │ Supabase Realtime — canais por contexto │
   │  tenant:X:notifications                 │
   │  tenant:X:kanban:P                      │
   │  deal:D                                 │
   │  project:P                              │
   │  conversation:C                         │
   │  user:U:presence                        │
   └────────────────────┬────────────────────┘
                        │ envelope leve
                        ▼
   ┌─────────────────────────────────────────┐
   │ Cliente: useRealtimeRouter (singleton)  │
   │  - dedup por client_request_id          │
   │  - coalesce 500ms                       │
   │  - lookup invalidationMap               │
   │  - queryClient.invalidateQueries        │
   └────────────────────┬────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
       useDeal(id)            useDealSummary(id)
       useProject(id)         usePipelineCounts(p)
                                  ▼
                             Header/Sidebar/Kanban
                             (todos lendo mesma projection)
```

---

## 12. Plano de rollout em fases

### Fase R0 — Fundação (sem realtime ainda)
- Criar `domain_events` (envelope §3), `*_summary` projections vazias, helpers `publishDomainEvent`.
- Migrar contadores hoje calculados no cliente para projections (trigger-based).
- Centralizar `invalidationMap` + `useRealtimeRouter` (sem subscriptions ativas, só estrutura).
- **Risco:** zero — código novo isolado.

### Fase R1 — Canal `deal:{id}` (piloto)
- Toda mutação de deal/proposta/documento publica no canal.
- DealDetalhe substitui suas N subscriptions por 1 canal.
- Validar coalesce, dedup, ausência de loops.
- **Risco:** baixo — escopo único.

### Fase R2 — Canais `tenant:X:kanban:P` e `tenant:X:notifications`
- Kanban comercial e operacional migram para 1 canal por pipeline.
- Sino de notificações via canal único.
- Remove subscriptions antigas em listas.
- **Risco:** médio — múltiplas telas tocadas; usar feature flag por tenant.

### Fase R3 — Canal `project:{id}` + execução
- Espelha R1 para mundo operacional.
- Inclui checklist, instalação, homologação.
- **Risco:** baixo — paralelo a R1.

### Fase R4 — Conversations + presence
- Canal `conversation:{id}` para chat WhatsApp.
- Canal `user:{id}:presence` para locks colaborativos.
- **Risco:** médio — volume de eventos alto, validar backpressure.

### Fase R5 — Cleanup
- Remover hooks antigos `useXyzRealtime` espalhados.
- Remover invalidações ad-hoc dos componentes.
- Deletar canais legados.
- **Risco:** baixo se R1–R4 ok.

### Fase R6 — Observabilidade
- Dashboard interno: canais ativos, eventos/min, coalesce ratio, lag de projection, conflitos 409.
- Alertas para storm/loop.

---

## 13. Riscos por fase + mitigação

| Fase | Risco | Mitigação |
|---|---|---|
| R0 | Trigger de projection com bug = badge errado | Testes de idempotência + rebuild script |
| R1 | Eventos perdidos (publish falha) | Outbox pattern: evento gravado primeiro, worker publica com retry |
| R2 | Kanban grande (>500 cards) recebendo muitos eventos | Filtro por stage no canal; coalesce agressivo |
| R3 | Workflow operacional emitindo eventos errados | Feature flag por tenant; rollback de policy |
| R4 | Chat com volume alto saturar canal | Rate limit no publish; chat usa canal próprio, não compartilha |
| R5 | Remover hook ainda em uso | Lint rule: proibir `postgres_changes` fora de `src/realtime/` |
| Geral | Custo Supabase Realtime explodir | Métrica "canais ativos por tenant"; alerta em 80% do plano |

---

## 14. Decisões finais (pedindo aprovação)

1. **Adotar canais por contexto** (deal/project/conversation/pipeline/tenant), não por tabela. ✅ recomendado
2. **Toda mutation grava `domain_events`** e dispara broadcast no canal certo (mesma transação). ✅ recomendado
3. **Projections substituem contadores no cliente** (`deal_summary`, `pipeline_stage_counts`, etc). ✅ recomendado
4. **`useRealtimeRouter` singleton** + `invalidationMap` central; componentes não invalidam. ✅ recomendado
5. **Optimistic updates restritos** a operações leves; mutations críticas esperam echo. ✅ recomendado
6. **Lint rule** proibindo `postgres_changes` fora de `src/realtime/`. ✅ recomendado
7. **Rollout faseado R0→R6**, feature flag por tenant em fases sensíveis. ✅ recomendado

---

## Próximo passo (somente após aprovação)

Iniciar **Fase R0**: criar `domain_events`, primeiras `*_summary` projections, `invalidationMap` e router singleton — **sem ainda mover subscriptions existentes**. Isso valida a fundação sem risco em produção.
