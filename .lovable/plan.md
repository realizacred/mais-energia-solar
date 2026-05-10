# /admin/followup-comercial — Central de Recuperação Comercial

Área enterprise para recuperação de propostas esquecidas, reaquecimento de leads frios e follow-up comercial governado, separada da inbox WhatsApp. **SSOT = proposta** (não conversa). Esta entrega é **somente auditoria + arquitetura + roadmap** — nada será implementado agora.

---

## 1. Diagnóstico do estado atual

### 1.1 Tabelas que JÁ EXISTEM (reaproveitáveis)

| Tabela | Papel hoje | Reuso na nova área |
|---|---|---|
| `propostas_nativas` | SSOT da proposta. Já tem `enviada_at`, `aceita_at`, `recusada_at`, `primeiro_acesso_em`, `ultimo_acesso_em`, `total_aberturas`, `status_visualizacao`, `public_token`, `deal_id`, `consultor_id`, `cliente_id`, `lead_id`, `is_principal`, `deleted_at` | **SSOT direto** da fila de follow-up. Nenhuma duplicação necessária. |
| `proposta_versoes` | Versões + `valor_total`, `viewed_at`, `enviado_em`, `valido_ate`, `status` | Source de KPIs financeiros e expiração |
| `proposta_views` | Tracking detalhado por acesso (token, IP, device, duration) | Score "engajamento de leitura" |
| `proposal_followup_queue` | Fila genérica `(tipo, status, payload jsonb)` — **subutilizada** | Reaproveitar como fila comercial (estender enums) |
| `reaquecimento_oportunidades` | Já tem `mensagem_sugerida`, `temperamento_detectado`, `dor_principal`, `urgencia_score`, `contexto_json`, `status`, `enviado_em`, `resultado`, `valor_perdido_acumulado` | **Núcleo de IA pronto** — só falta UI e job que popula |
| `wa_followup_queue` / `wa_followup_logs` / `wa_followup_rules` | Follow-up **operacional** pós-conversa WhatsApp (inbox) | **Não reusar** — escopo diferente (operacional vs comercial). Compartilhar apenas helper de envio. |
| `deals` + `pipeline_stages` | Estágio comercial e `is_closed` | Filtrar leads ainda em aberto |
| `lead_status` | Status do lead (Perdido, Convertido, etc.) | Excluir Perdido/Convertido da fila |

### 1.2 Edge functions JÁ EXISTENTES (reaproveitáveis)

| Função | Uso atual | Uso novo |
|---|---|---|
| `reaquecimento-analyzer` | Analisa leads inativos, popula `reaquecimento_oportunidades` | **Estender** para incluir critério "proposta enviada e parada" |
| `ai-followup-intelligence` | IA de sugestão de follow-up | Reusar para gerar `mensagem_sugerida` por proposta |
| `ai-followup-planner` | Planeja sequência de follow-up | Reusar para definir cadência (D+3, D+7, D+15) |
| `ai-suggest-message` | Gera mensagem personalizada | Reusar no botão "Sugerir abordagem" |
| `ai-proposal-explainer` | Explica proposta ao cliente | Reusar em mensagem de retomada |
| `proposal-auto-expire` | Expira propostas vencidas (cron 08:00 UTC) | Já cobre expiração — apenas alimenta KPI |
| `proposal-decision-notify` | Notifica vendedor sobre aceite/recusa | Já existe — não duplicar |
| `approve-proposal-followup` | Approval workflow de envio de follow-up | **Reusar** como gate de disparo |
| `send-proposal-message` / `send-whatsapp-message` | Envio via Evolution | Canal único de disparo (com `enqueue_wa_outbox_item`) |
| `process-wa-followups` (cron) | Processa fila operacional WA | Padrão a copiar para `process-proposal-followups` |

### 1.3 Frontend reaproveitável

- `useProposalTracking` — leitura de `proposta_views`, métricas de visualização
- `ProposalViewsCard` — componente de exibição de views (reusar dentro do drawer)
- `useFollowUpQueue`, `useWaFollowupPending`, `useWaFollowup` — **NÃO reusar** (operacional). Criar hooks novos com namespace `useProposalFollowup*`
- `AiFollowupSettingsPanel` — painel de regras IA (extender com regras comerciais)
- `WaFollowupWidget` — referência de UX de fila

### 1.4 O que está QUEBRADO ou INCOMPLETO

1. **`reaquecimento_oportunidades` populada esporadicamente** — não há cron regular alimentando a tabela com base em propostas paradas (apenas leads).
2. **`proposal_followup_queue` praticamente vazia** — schema genérico sem enums consolidados, sem cron consumidor, sem UI.
3. **Não existe view consolidada** "proposta abandonada" — hoje requer JOIN ad-hoc entre `propostas_nativas`, `proposta_views`, `wa_messages`, `deals`.
4. **Falta `temperatura` calculada** — campo conceitual; precisa virar coluna derivada (view) ou função.
5. **Não há `proposal_followup_attempts`** — histórico por tentativa (qual mensagem, quando, resultado, canal).
6. **Anti-spam não centralizado** — hoje cada função tem cooldown próprio; precisa SSOT (`proposal_followup_locks`).
7. **Sem opt-out por cliente para canal comercial** — só opt-out global de WA.
8. **IA não tem feedback loop** — `reaquecimento_oportunidades.resultado` raramente preenchido.

### 1.5 Duplicações identificadas

- 3 tabelas de fila: `proposal_followup_queue`, `wa_followup_queue`, `reaquecimento_oportunidades` com sobreposição parcial. **Decisão:** manter as 3 com escopos claros (ver §3.1).
- 2 hooks de follow-up (`useWaFollowup` operacional vs futuro `useProposalFollowup` comercial). Documentar barreira semântica no AGENTS.md.

---

## 2. Arquitetura ideal — visão de negócio

```text
                    ┌─────────────────────────────────────┐
                    │  SSOT: propostas_nativas + versoes  │
                    └──────────────┬──────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
       proposta_views       deals/pipeline       wa_messages
       (engajamento)        (estágio aberto)     (última interação)
               │                   │                   │
               └───────────┬───────┴───────────────────┘
                           ▼
               vw_proposal_followup_inbox  (view materializada/computada)
                           │
        ┌──────────────────┼─────────────────────────────────┐
        ▼                  ▼                                 ▼
   UI /admin/         proposal_followup_              IA: reaquecimento-
   followup-          queue + attempts                analyzer + ai-followup-
   comercial          (controle de disparo)           intelligence
        │                  │                                 │
        └──────────────────┴────────────► send-whatsapp-message (single channel)
                                          + opt-out check + cooldown
```

**Princípio chave:** **proposta é a entidade rastreada**, não a conversa. Uma proposta é "esquecida" mesmo que o WhatsApp pessoal do vendedor tenha trocado mensagens (que o sistema não vê). Critério de "parada" usa `ultimo_acesso_em` (proposta) + `last_seen_in_inbox` (se houver) + `last_followup_attempt_at`.

---

## 3. Estrutura de banco recomendada (NÃO criar agora)

### 3.1 Tabelas novas

```sql
-- Histórico granular de tentativas (1 linha por disparo)
proposal_followup_attempts (
  id, tenant_id, proposta_id, versao_id, consultor_id,
  attempt_number int,                  -- 1ª, 2ª, 3ª…
  channel text,                        -- 'whatsapp' | 'email' | 'manual_note'
  mode text,                           -- 'manual' | 'semi_auto' | 'auto'
  template_id uuid null,
  message_text text,
  ai_generated boolean,
  ai_model text null,
  ai_prompt_id uuid null,
  scheduled_for timestamptz,
  sent_at timestamptz null,
  delivery_status text,                -- queued|sent|delivered|read|failed|skipped
  delivery_error text,
  client_response_at timestamptz null, -- preenchido por trigger ao detectar wa_message recebida
  outcome text,                        -- 'no_reply'|'reply_positive'|'reply_negative'|'reopened'|'converted'
  approved_by uuid null,
  created_at, updated_at
)

-- Trava anti-spam: 1 lock por (proposta, canal)
proposal_followup_locks (
  proposta_id, channel, locked_until, reason, created_at  PRIMARY KEY (proposta_id, channel)
)

-- Memória comercial estruturada (substitui notas soltas)
proposal_commercial_memory (
  id, tenant_id, proposta_id,
  objecao_principal text,
  temperatura text,                    -- 'quente'|'morno'|'frio'|'congelado'
  score_recuperacao numeric,           -- 0..100
  ultima_justificativa text,
  proxima_acao_sugerida text,
  proxima_acao_em timestamptz,
  notas_ia jsonb,
  updated_by uuid, updated_at
)

-- Opt-out comercial granular (canal/categoria)
proposal_communication_optout (
  cliente_id, channel, category, opted_out_at, reason  PRIMARY KEY (cliente_id, channel, category)
)

-- Regras de cadência por tenant (config admin)
proposal_followup_cadence_rules (
  id, tenant_id, name, active boolean,
  trigger_after_days int,              -- D+3, D+7…
  required_status text[],              -- ['enviada','visualizada']
  excluded_status text[],              -- ['aceita','recusada']
  channel text, mode text,             -- modo padrão
  template_id uuid, ai_enabled boolean,
  daily_cap int, hour_window jsonb,    -- {start:9,end:18,tz:'America/Sao_Paulo'}
  weekday_mask int                     -- bitmask seg-dom
)
```

### 3.2 View canônica (SSOT da tela)

```sql
CREATE VIEW vw_proposal_followup_inbox AS
SELECT
  p.id AS proposta_id, p.tenant_id, p.consultor_id, p.cliente_id, p.lead_id,
  p.codigo, p.titulo, p.status, p.enviada_at, p.aceita_at, p.recusada_at,
  p.primeiro_acesso_em, p.ultimo_acesso_em, p.total_aberturas,
  v.valor_total, v.valido_ate, v.viewed_at,
  c.nome AS cliente_nome, c.telefone_normalized,
  EXTRACT(EPOCH FROM (now() - GREATEST(p.enviada_at, p.ultimo_acesso_em, last_att.sent_at))) / 86400 AS dias_parado,
  CASE
    WHEN p.aceita_at IS NOT NULL OR p.recusada_at IS NOT NULL THEN 'fechado'
    WHEN p.ultimo_acesso_em IS NULL AND p.enviada_at < now() - interval '3 days' THEN 'enviada_sem_view'
    WHEN p.ultimo_acesso_em IS NOT NULL AND p.ultimo_acesso_em < now() - interval '7 days' THEN 'view_sem_resposta'
    WHEN last_att.sent_at IS NOT NULL AND last_att.client_response_at IS NULL THEN 'followup_sem_resposta'
    ELSE 'monitorar'
  END AS classe_followup,
  COALESCE(mem.temperatura, 'morno') AS temperatura,
  COALESCE(mem.score_recuperacao, 50) AS score_ia,
  mem.proxima_acao_sugerida AS sugestao_ia,
  COALESCE(att_count.n, 0) AS qtd_followups,
  last_att.message_text AS ultima_mensagem,
  last_att.channel AS ultimo_canal,
  last_att.outcome AS status_followup
FROM propostas_nativas p
JOIN proposta_versoes v ON v.id = (SELECT id FROM proposta_versoes WHERE proposta_id=p.id ORDER BY versao_numero DESC LIMIT 1)
LEFT JOIN clientes c ON c.id = p.cliente_id
LEFT JOIN proposal_commercial_memory mem ON mem.proposta_id = p.id
LEFT JOIN LATERAL (...) last_att ON true
LEFT JOIN LATERAL (...) att_count ON true
WHERE p.deleted_at IS NULL AND p.status NOT IN ('aceita','recusada','expirada');
```

### 3.3 RLS

Todas as tabelas novas: RLS por `tenant_id` via `auth.jwt() ->> 'tenant_id'` e `WITH CHECK` no INSERT (RB já documentada). Vendedor vê apenas próprias propostas (`consultor_id = auth.uid()`); admin vê todas do tenant.

---

## 4. Edge functions — novas e estendidas

### Novas
- **`proposal-followup-classify`** (cron 6/6h): roda `vw_proposal_followup_inbox`, recalcula `temperatura`, `score_recuperacao`, gera entradas em `proposal_followup_cadence_rules` matched.
- **`proposal-followup-suggest`** (sob demanda): chama `ai-followup-intelligence` + `ai-proposal-explainer` para gerar `mensagem_sugerida` contextualizada (lida histórico, valor, objeções).
- **`process-proposal-followups`** (cron a cada 10min): consome `proposal_followup_queue` respeitando `proposal_followup_locks`, opt-out, janela horária, daily_cap. Chama `send-whatsapp-message`.
- **`proposal-followup-feedback`** (trigger via `wa_messages` INSERT do cliente): detecta resposta dentro de 7d do disparo e atualiza `proposal_followup_attempts.client_response_at` + `outcome`.

### Estendidas (sem reescrever)
- `reaquecimento-analyzer`: incluir critério "proposta `enviada_sem_view > 5d` ou `view_sem_resposta > 10d`".
- `approve-proposal-followup`: virar gate obrigatório no modo `auto` quando `attempt_number > 2`.

### Cron (pg_cron, NÃO migration — usar insert tool)
- `proposal-followup-classify` — `0 */6 * * *`
- `process-proposal-followups` — `*/10 * * * *` (apenas dentro da janela 8h-20h America/Sao_Paulo)

---

## 5. Estrutura frontend

```
src/pages/admin/followup-comercial/
├── FollowupComercialPage.tsx          (shell: PageHeader + KPIs + Tabs)
├── tabs/
│   ├── FilaTab.tsx                    (tabela principal)
│   ├── PrioridadeIATab.tsx            (top 20 score IA)
│   ├── EsquecidasTab.tsx              (>30/60/90d)
│   └── HistoricoTab.tsx               (attempts + outcomes)
├── components/
│   ├── FollowupKpiBar.tsx
│   ├── FollowupFilters.tsx
│   ├── FollowupTable.tsx
│   ├── FollowupRowActions.tsx         (botões: Sugerir IA, Enviar manual, Agendar, Snooze)
│   ├── FollowupDrawer.tsx             (detalhe lateral: views, attempts, memory, IA)
│   ├── AiSuggestionPanel.tsx
│   ├── SendFollowupDialog.tsx         (preview + approval)
│   └── CadenceRulesPanel.tsx          (admin)
└── hooks/
    ├── useProposalFollowupInbox.ts    (lê vw_proposal_followup_inbox)
    ├── useProposalFollowupAttempts.ts
    ├── useProposalCommercialMemory.ts
    ├── useProposalFollowupSuggest.ts  (chama edge proposal-followup-suggest)
    └── useSendProposalFollowup.ts     (queue + approval)
```

**Padrões obrigatórios (do AGENTS):** `PageHeader`, KPI cards `border-l-*`, `<LoadingState />`, `text-*-foreground`, `queryClient.invalidateQueries` (nunca reload), realtime cleanup síncrono, ErrorBoundary no shell, hooks dedicados (não `useQuery` solto).

---

## 6. Estrutura IA

| Caso | Edge | Modelo | Prompt source |
|---|---|---|---|
| Score recuperação + temperatura | `proposal-followup-classify` | `google/gemini-3-flash-preview` | Prompt no backend, contexto: dias parado, valor, views, histórico |
| Sugerir mensagem retomada | `proposal-followup-suggest` | `google/gemini-3-flash-preview` | Inclui últimas 3 wa_messages + objeções memorizadas |
| Detectar objeção da resposta | `proposal-followup-feedback` | `google/gemini-2.5-flash-lite` | Tool calling estruturado → `objecao_principal`, `outcome` |
| Melhor horário | regra heurística + fallback IA | — | Histórico de respostas do cliente |

**Anti-spam IA:**
- Hash da última mensagem em `proposal_followup_locks.last_message_hash` — bloquear reenvio idêntico ≤30d.
- Limite por cliente: máx 3 tentativas IA em 30d sem resposta → marca `temperatura='congelado'`, exige aprovação humana.

---

## 7. Modos de disparo

| Modo | Quem dispara | Approval | Uso |
|---|---|---|---|
| **Manual** | Vendedor clica "Enviar agora" | Não | Default vendedor |
| **Semi-auto** | Sistema agenda, vendedor confirma no drawer | Sim (1-clique) | Default tenant |
| **Auto** | Cron consome fila, envia direto | Apenas se `cadence_rules.ai_enabled=true` E `attempt_number ≤ 2` | Opcional, off por default |

**Guardrails universais:**
- Cooldown mín 48h entre disparos para o mesmo cliente
- Janela: 9h–18h America/Sao_Paulo, seg-sex (configurável)
- Daily cap por consultor (default 30)
- Opt-out → bloqueio absoluto
- Cliente com WA conversation ativa <24h → bloquear (já está em conversa real)
- LGPD: registrar `legal_basis='legitimate_interest'` + link de descadastro

---

## 8. Roadmap em fases

### Fase 0 — Fundamentos (1 sprint, sem UI nova)
1. Migration: criar `proposal_followup_attempts`, `proposal_followup_locks`, `proposal_commercial_memory`, `proposal_communication_optout`, `proposal_followup_cadence_rules` + RLS + índices.
2. Migration: `vw_proposal_followup_inbox` + RPC `get_followup_kpis(tenant_id)`.
3. Trigger: ao inserir em `wa_messages` (direção=in), atualizar `last_att.client_response_at`.

### Fase 1 — UI read-only (1 sprint)
4. Página `/admin/followup-comercial` com KPIs, filtros e tabela lendo da view (sem disparo).
5. Drawer com `proposta_views`, attempts, memory, sugestão IA (botão "Gerar sugestão" — manual).
6. Edge `proposal-followup-suggest` (sob demanda).

### Fase 2 — Disparo manual + semi-auto (1 sprint)
7. `useSendProposalFollowup` + `SendFollowupDialog` com preview, anti-spam e opt-out check.
8. Inserção em `proposal_followup_attempts` + `proposal_followup_queue`.
9. `process-proposal-followups` (cron 10min) com guardrails.

### Fase 3 — IA classificação + cadência (1 sprint)
10. `proposal-followup-classify` (cron 6h) populando `proposal_commercial_memory`.
11. `CadenceRulesPanel` (admin) — CRUD de regras.
12. Approval workflow via `approve-proposal-followup`.

### Fase 4 — Modo auto controlado (1 sprint)
13. Toggle `auto` por regra. Daily cap. Janela horária. Pausas automáticas.
14. Feedback loop: `proposal-followup-feedback` + dashboard "taxa de recuperação".

### Fase 5 — Otimizações
15. Best-time prediction. A/B de templates. Score IA refinado.

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Spam ao cliente | Cooldown SSOT, opt-out, hash anti-duplicidade, daily cap, bloqueio se conversa ativa |
| Sobreposição com inbox WA | Barreira semântica documentada no AGENTS.md (RB nova); hooks com namespaces distintos |
| RLS vazando entre tenants | Padrão RB (auth.jwt → tenant_id) em todas as 5 tabelas + view + RPCs |
| IA gerando mensagem ruim | Modo padrão = semi-auto (humano confirma); auto exige `cadence_rules.approved=true` |
| Custo IA explodindo | Classify só em propostas mudaram (where `updated_at > last_classify_at`); modelo flash-lite |
| Migração SolarMarket interferindo | View exclui `status IN ('aceita','recusada','expirada')`; migrados entram naturalmente |
| Conflito com `proposal-auto-expire` | View já filtra expiradas; sem duplicação |
| Performance da view | Índices em `propostas_nativas(tenant_id, status, ultimo_acesso_em)`, `proposal_followup_attempts(proposta_id, sent_at DESC)` |

---

## 10. Governança

- **Auditoria:** todo INSERT em `proposal_followup_attempts` é imutável (sem UPDATE de `message_text` após `sent_at`).
- **Logs:** `delivery_status`, `delivery_error`, `outcome`, `approved_by` rastreáveis.
- **Permissões:** `view_followup_comercial` (vendedor: próprios; admin: todos), `send_followup_manual`, `configure_cadence_rules` (admin), `approve_followup_auto` (admin).
- **Multi-tenant:** RLS + WITH CHECK + view filtrada por `tenant_id`.
- **LGPD:** opt-out granular, base legal registrada, link de descadastro nos templates.

---

## 11. Checklist final

- [x] Auditoria completa de tabelas, edges, hooks, components
- [x] Reuso identificado: `propostas_nativas`, `proposta_views`, `reaquecimento_oportunidades`, `proposal_followup_queue`, edges `ai-followup-*`, `reaquecimento-analyzer`, `approve-proposal-followup`, `send-whatsapp-message`
- [x] Quebras/lacunas listadas (cron faltando, view ausente, attempts inexistente, opt-out granular ausente)
- [x] Arquitetura de banco, frontend, IA e automação definidas
- [x] Roadmap 5 fases sem implementação destrutiva
- [x] Riscos mapeados e mitigados
- [x] Governança multi-tenant, anti-spam, LGPD definidas
- [x] Build e dados atuais não impactados (zero alteração nesta entrega)

**Próximo passo sugerido:** aprovar este plano → executar **Fase 0** (apenas migration + view + trigger, sem UI).