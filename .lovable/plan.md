# Refinamento Arquitetural — Pré-Fase 0

> Status: **DESENHO**. Nada vai para migration até este documento ser aprovado.
> Objetivo: fechar os 10 riscos levantados antes de tocar em schema/código.

---

## 1. Refinamento final dos aggregates

### Aggregate roots (fontes da verdade)

| Aggregate | Responsabilidade | Identidade |
|---|---|---|
| **Customer** | Pessoa/empresa cadastral. Sem estado comercial. | `customer_id` |
| **Opportunity** | Intenção comercial (ex-lead/ex-deal). Lifecycle: `qualifying → proposing → negotiating → won/lost`. | `opportunity_id` |
| **Proposal** | Documento comercial versionado. Pertence a 1 Opportunity. Lifecycle: `draft → sent → accepted/rejected/expired`. | `proposal_id` |
| **Contract** | Vínculo jurídico-financeiro. Nasce de uma `Proposal.accepted`. Aggregate root do **Financeiro**. | `contract_id` |
| **WorkOrder** (Execução) | Ordem operacional. **NÃO é aggregate root**: é projection derivada de `Contract` + `WorkflowState`. | `contract_id` (mesmo) |
| **EnergyAsset** (UC/usina) | Cadastro físico. Pode existir sem contrato (monitoramento puro). | `asset_id` |

### Mudança chave vs desenho anterior
- **Financeiro deixa de ser aggregate solto.** Vira **`Contract` aggregate** com um *financial ledger* interno (entries imutáveis: `billing_scheduled`, `invoice_emitted`, `payment_received`, `commission_accrued`, `commission_paid`, `refund_issued`).
- **Sem Contract → sem ledger.** Elimina financeiro órfão por construção.
- **Execução é projection** sobre `Contract` + eventos de workflow. Não tem ledger próprio, não emite eventos canônicos do negócio (só *operational facts* que viram input para projections).

```text
Customer ──< Opportunity ──< Proposal ──┐
                                        ▼
                                    Contract (AGG ROOT financeiro)
                                        │
                          ┌─────────────┼─────────────┐
                          ▼             ▼             ▼
                    FinancialLedger  WorkflowState  WorkOrder
                       (entries)     (transitions)  (projection)
EnergyAsset ────────────────────────────┘
```

---

## 2. Estratégia de eventos — *business semantic*, não CRUD

### Convenção de nome
`{aggregate}.{fact_pretérito}` — sempre fato de negócio, nunca operação técnica.

### Catálogo canônico (v1)

**Opportunity**
- `opportunity.qualified`
- `opportunity.won` *(ex-`commercial.won`)*
- `opportunity.lost { reason }`

**Proposal**
- `proposal.sent`
- `proposal.accepted` *(canonical — substitui `proposal.contracted`)*
- `proposal.rejected`
- `proposal.expired`

**Contract**
- `contract.created` *(emitido como reação a `proposal.accepted`, não como gatilho direto)*
- `contract.signed`
- `contract.cancelled { reason }`
- `contract.completed`

**Financial (subdomínio do Contract)**
- `billing.scheduled`
- `invoice.issued`
- `payment.received { amount, method }`
- `payment.refunded`
- `commission.accrued`
- `commission.settled`

**Execution (operational facts)**
- `execution.authorized` *(gerado por policy, não por trigger direto de "won")*
- `installation.scheduled`
- `installation.completed`
- `homologation.approved`
- `project.energized`

### Princípio de desacoplamento
- Operacional **não consome** `payment.received`. Consome `execution.authorized`, que é emitido por uma **policy** que sabe ler ledger interno (ex.: "≥30% pago + contrato assinado").
- Frontend operacional **nunca vê** valores financeiros via evento. Vê via projection autorizada.

### Substituição dos gatilhos atuais
| Antigo (acoplado) | Novo (semântico) |
|---|---|
| trigger `deal.stage=won` → cria projeto | policy assina `opportunity.won` → emite `contract.created` → policy assina `contract.signed + first_payment` → emite `execution.authorized` |
| `proposal.contracted` | `proposal.accepted` (canonical) + `contract.created` (reação) |
| trigger direto "iniciar instalação" | `execution.authorized` consumido por workflow engine |

---

## 3. Domain event envelope — governance

Toda mensagem persistida em `domain_events` tem este envelope (imutável):

```text
{
  event_id              uuid    -- PK
  event_type            text    -- "proposal.accepted"
  event_version         int     -- versão do contrato semântico (1, 2, ...)
  schema_version        int     -- versão do payload JSON
  aggregate_type        text    -- "proposal"
  aggregate_id          uuid
  aggregate_version     bigint  -- nº sequencial por aggregate (concurrency guard)
  tenant_id             uuid
  occurred_at           timestamptz
  recorded_at           timestamptz
  correlation_id        uuid    -- liga uma cadeia de causa-efeito
  causation_id          uuid    -- event_id que causou este
  actor                 jsonb   -- { type: user|system|policy, id, name }
  payload               jsonb   -- imutável após persistido
  metadata              jsonb   -- ip, user_agent, source_app
}
```

Regras:
- `aggregate_version` aplica **optimistic concurrency**: insert falha se versão esperada não bate.
- Migrações de schema **nunca** reescrevem eventos antigos. Usa-se *upcasters* na leitura.
- `event_type` + `event_version` é o contrato público; `schema_version` é detalhe interno do payload.

---

## 4. Estratégia de projections

### Tipos
1. **Read models** (UI/listagens): `opportunities_list`, `contracts_kanban`, `financial_dashboard`, `execution_board`.
2. **Capability projections** (ver §6).
3. **Cross-aggregate projections** (ex: `customer_360` agrega Opportunity + Contract + Asset).

### Mecânica
- Cada projection é uma **tabela materializada** alimentada por *projector workers* que consomem `domain_events` em ordem por `aggregate_id`.
- Cada projector grava seu *checkpoint*: `(projection_name, last_event_id, last_aggregate_version)`.
- Projections são **idempotentes**: reaplicar o mesmo evento não muda estado.

### Invalidação
- Realtime para o frontend é emitido **pela projection**, não pelo evento de domínio (ver §8).

---

## 5. Multi-tenant — invariantes

- `tenant_id` em **toda** linha de `domain_events`, projections e workflow tables. Não-nulo, indexado, presente em RLS.
- Aggregate roots carregam `tenant_id`. Eventos herdam.
- Projectors processam **partições por tenant** para isolamento de falha (um tenant travado não bloqueia outros).
- Workflow definitions (§7) podem ser globais OU por tenant (override).

---

## 6. Capabilities — projection-driven UI

### Tabela `entity_capabilities` (projection)

```text
tenant_id, aggregate_type, aggregate_id, capability, allowed boolean, reason text, computed_at
```

### Catálogo inicial
- `can_generate_contract` (Opportunity won + sem contrato ativo)
- `can_send_proposal` (Proposal draft + cliente com email)
- `can_accept_proposal` (Proposal sent + não expirada + assinatura ok)
- `can_emit_invoice` (Contract signed + billing scheduled na data)
- `can_register_payment` (Contract com saldo > 0)
- `can_authorize_execution` (Contract signed + ledger atende policy)
- `can_start_installation` (execution_authorized + agenda + equipe)
- `can_finalize_project` (installation_completed + homologation_approved)
- `can_cancel_contract` (Contract não completed)

### Regra de uso
- **Frontend nunca decide habilitar botão por status.** Lê `capabilities[entity_id].can_X`.
- Backend valida a mesma capability antes de aceitar comando (defense in depth).
- Capability projection é recomputada por evento, com `reason` populado para tooltip.

---

## 7. Workflow governance — sem hardcode

### Tabelas
```text
workflow_definitions       (id, tenant_id?, aggregate_type, name, version, active)
workflow_states            (definition_id, key, label, is_initial, is_terminal)
workflow_transition_rules  (definition_id, from_state, to_state, trigger_event, guard_expr, action_expr)
workflow_instances         (id, definition_id, aggregate_id, current_state, version)
workflow_transition_log    (instance_id, from, to, event_id, occurred_at)
```

### Princípios
- Workflow é **dado**, não código. Adicionar etapa = `INSERT`, não deploy.
- `tenant_id NULL` = definição global; tenant pode publicar override versionado.
- `guard_expr` e `action_expr` em DSL restrita (whitelist de funções) — sem `eval` arbitrário.
- Workflows operacionais (instalação, homologação) são instâncias separadas do contrato — múltiplos workflows convivem por aggregate.

---

## 8. Realtime governance — frontend isolado de eventos brutos

### Camadas
1. `domain_events` (interno, **nunca** vai para o canal Realtime do cliente).
2. `projection_changes` (broadcast leve: `{ projection, key, version, op }`).
3. Cliente assina `projection_changes` filtrado por tenant + projection relevante.

### UI-safe events
Catálogo fechado e versionado:
- `ui.opportunity.updated { id }`
- `ui.contract.financial_summary.updated { id }`
- `ui.execution.board.updated { contract_id }`
- `ui.notification.new { id }`

Frontend **só** chama `queryClient.invalidateQueries` baseado nesse catálogo. Nunca lê payload sensível do canal.

---

## 9. Anti-falha — retries, DLQ, failed projections

### Política por camada

| Camada | Estratégia |
|---|---|
| **Command handler** | Falha = nada persiste (transação). Cliente recebe erro. |
| **Event projector** | Retry exponencial (5x: 1s/5s/30s/2m/10m). Falha persistente → `failed_projections` (DLQ). Projector continua a partir do próximo evento (não bloqueia stream). |
| **Policy/reactor** | Mesmo que projector + alertas críticos. Idempotência obrigatória via `causation_id` único. |
| **External integrations** (signatário, gateway pagto) | Outbox pattern: evento gravado primeiro, worker tenta entregar com retry, registra em `integration_attempts`. |

### Tabelas
```text
failed_projections      (projection_name, event_id, error, attempts, first_failed_at, last_attempt_at)
integration_outbox      (id, target, payload, status, attempts, next_retry_at)
dead_letter_events      (event_id, reason, moved_at)  -- ação manual obrigatória
```

### Observabilidade
- Dashboard "saúde de projections": lag por projector, DLQ count, retries em andamento.
- Alerta quando lag > 30s ou DLQ > 0.

---

## 10. Replay & rebuild

### Princípios
- **`domain_events` é a única fonte da verdade.** Toda projection é descartável e reconstruível.
- Snapshots são **otimização**, não correção.

### Snapshot strategy
- Snapshot de aggregate state a cada N eventos (default 100) em `aggregate_snapshots`.
- Replay carrega último snapshot + eventos posteriores.
- Snapshot é versionado pelo `aggregate_version` que ele representa.

### Rebuild de projection (operação rotineira)
1. `TRUNCATE` projection + checkpoint.
2. Worker reprocessa `domain_events` em ordem por aggregate.
3. Switchover atômico: rebuild em tabela `_new`, `RENAME` no fim.
4. Tempo estimado por projection registrado em `projection_metadata`.

### Replay seletivo
- Por aggregate (`aggregate_id`), por janela de tempo, por `correlation_id` (auditoria de cadeia).

---

## 11. Rollback strategy

### Princípio
Eventos são imutáveis. **Não se "deleta" evento.** Reverte-se com **evento compensatório**.

| Cenário | Ação |
|---|---|
| Projeção corrompida | Rebuild (§10). |
| Evento emitido errado | `*.compensated` event + correção semântica (`payment.refunded` para `payment.received` errado). |
| Migration de schema com problema | Rollback DDL + nova migration. Eventos antigos lidos via upcaster. |
| Workflow definition quebrada | Rollback para versão anterior (`workflow_definitions.active`). Instâncias em curso terminam na versão antiga. |
| Bug em policy/reactor | Desativar policy, identificar eventos não-processados, re-enfileirar após fix. |

### Feature flags
Toda nova policy/reactor entra atrás de flag por tenant antes de virar default.

---

## 12. Evolução futura

### Princípios para não quebrar daqui pra frente
1. **Aditivo > destrutivo.** Novo campo no payload = `schema_version++`, leitura via upcaster.
2. **Novo evento > mudar evento.** Renomear/mudar semântica = `event_type` novo + deprecar antigo com janela de coexistência.
3. **Capability nova** é só uma regra na projection — não exige mudança no frontend além de exibir botão se `allowed`.
4. **Novo workflow** = `INSERT` em `workflow_definitions` v2; instâncias antigas continuam na v1.
5. **Novo aggregate** entra como módulo isolado; integra via eventos, nunca via FK direta a tabelas de outro módulo.

### Roadmap sugerido pós-Fase 0
- Fase 1: aggregates Customer + Opportunity + Proposal + Contract + event store + projections básicas.
- Fase 2: capability projections + frontend migrado para capabilities.
- Fase 3: workflow engine genérico (substitui hardcodes restantes).
- Fase 4: outbox + integrações externas (signatário, pagto).
- Fase 5: snapshot/replay tooling + dashboard de saúde.
- Fase 6: workflow custom por tenant.

---

## Diagrama consolidado

```text
                        ┌──────────────────────────┐
   Comandos UI ───────► │   Command Handlers       │
                        │ (validate + capability)  │
                        └────────────┬─────────────┘
                                     │ append
                                     ▼
                        ┌──────────────────────────┐
                        │   domain_events (SSOT)   │◄────── snapshots
                        │ envelope completo §3     │
                        └────────────┬─────────────┘
                                     │ stream ordenado
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ┌──────────┐           ┌──────────┐          ┌──────────────┐
        │Projectors│           │ Policies │          │  Outbox      │
        │ (read    │           │/Reactors │          │ (integrações)│
        │ models)  │           │ emitem   │          │              │
        └────┬─────┘           │ novos    │          └──────┬───────┘
             │                 │ eventos  │                 │
             ▼                 └────┬─────┘                 ▼
       ┌──────────┐                 │              external systems
       │capability│                 │ append
       │projection│                 ▼
       └────┬─────┘           domain_events (loop)
            │
            ▼
     ┌──────────────────┐
     │projection_changes│──► Realtime (UI-safe)──► Frontend
     └──────────────────┘                          (capabilities)
```

---

## Riscos residuais a confirmar antes da Fase 0

1. **Migração do legado**: como traduzir `deals` + `projetos` + `propostas_nativas` atuais em `Opportunity/Contract/Proposal` sem perder histórico → exige *backfill* gerando eventos sintéticos ordenados.
2. **Performance event store** em escala (centenas de milhares por tenant): definir particionamento (`tenant_id` + mês) já na Fase 0.
3. **Custo Realtime Supabase**: estimar canais simultâneos por tenant antes de habilitar `projection_changes` em massa.
4. **DSL de guards/actions** (§7): definir gramática mínima para evitar reescrever em código depois.

---

## Decisão pedida

Aprovar este refinamento (ou apontar pontos a revisar) **antes** de eu propor a Fase 0:
- criar tabelas `domain_events`, `aggregate_snapshots`, `failed_projections`, `integration_outbox`;
- scaffolding do command bus + projector runtime;
- primeira projection (Opportunity) como prova de conceito.
