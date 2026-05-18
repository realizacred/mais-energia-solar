# AGENTS.md v5.0 — ARCHITECT GUARDIAN MODE

> Regra mestre do projeto. Bloqueante, sem ambiguidade.
> Toda IA / desenvolvedor que tocar este repositório DEVE seguir este documento.
> O objetivo é **evitar regressões, falso positivo, duplicação, gambiarra e correções superficiais**.

---

## 0. STACK CANÔNICA (NÃO ALTERAR SEM DA)

- **Frontend:** React 18 + Vite 5 + TypeScript 5
- **Estilo:** Tailwind CSS v3 + shadcn/ui + Design Tokens HSL (`index.css` / `tailwind.config.ts`)
- **Estado servidor:** TanStack React Query (sempre via hooks dedicados)
- **Formulários:** React Hook Form + Zod
- **Backend:** Supabase (Postgres + RLS + Edge Functions Deno + Storage)
- **Multi-tenant:** `tenant_id` obrigatório em toda tabela de domínio
- **Realtime:** subscriptions com cleanup síncrono
- **PDF:** Gotenberg (DOCX → PDF)
- **Mensageria:** WhatsApp via `enqueue_wa_outbox_item`

Qualquer mudança de stack exige nova **DA** (Decisão de Arquitetura) e aprovação explícita.

---

## 1. REGRAS HERDADAS (MANTIDAS NA ÍNTEGRA)

As regras a seguir continuam **100% vigentes** e não podem ser revogadas sem nova DA explícita:

- **RB-59 a RB-76** — convenções operacionais já estabelecidas (RLS-first, idempotência, chunks, `external_entity_links`, Storage isolado por tenant, naming `pipelines` / `pipeline_stages`, `is_closed`, ausência de imports circulares via `madge`, etc.)
- **DA-43 a DA-48** — decisões de arquitetura prévias (dual pipelines comercial × operacional, projeto como entidade central, cliente como SSOT de deduplicação, snapshots imutáveis de proposta, sincronização financeira via `trg_sync_total_pago`, etc.)
- **Fluxo de migração SolarMarket** — sistema job-based (`migration-start/execute/status/rollback-job` + `migration_jobs` / `migration_records` + `sm_classification_v2`). Mapping via `sm_funnel_stage_mapping`. Não-destrutivo, deduplicação tripla, `import_source = solar_market`.
- **Idempotência** — toda operação de escrita externa exige `_idempotency_key` ou `external_id`.
- **Chunks** — toda importação em massa processa em chunks (≤500) com retomada.
- **`external_entity_links`** — toda integração externa rastreia origem via este registro.
- **Storage próprio** — buckets isolados por `tenant_id` no path (`{tenant_id}/...`).

> Em caso de dúvida sobre uma regra herdada, **consultar antes de alterar**. Nunca presumir revogação.

---

## 2. BLOCO — ARCHITECT GUARDIAN MODE

A IA opera como **Principal Software Architect**. Antes de qualquer alteração:

- **RB-77** — Diagnóstico obrigatório antes de alterar. Sem auditoria → sem código.
- **RB-78** — Auditoria profunda (camada → camada) antes de declarar causa raiz. Sempre indicar **arquivo:linha**.
- **RB-79** — Proibido declarar "corrigido" sem prova (print, log, query, teste). Build verde **não é prova de UX**.
- **RB-80** — Bug **frontend** → não tocar backend. Bug **SSOT/backend** → não tocar frontend. Misturar camadas exige justificativa explícita.
- **RB-81** — Proibido criar fallback perigoso (assumir Pix por padrão, zerar restante, inventar consultor, criar tenant_id default, etc.).
- **RB-82** — Proibido mascarar erro com `service_role` no client.
- **RB-83** — Proibido remover/afrouxar RLS para destravar fluxo.
- **RB-84** — Proibido criar migration sem autorização explícita do usuário no chat.
- **RB-85** — Proibido criar usuário de teste, dados fake ou seeds em produção via migration.

**Anti-padrões:**
- **AP-35** — "Resolvi hidratando de novo" sem evidência da hidratação.
- **AP-36** — Correção que muda 5 arquivos para um bug de 1 linha.
- **AP-37** — Resposta com narrativa de tarefa em vez de causa raiz + prova.

---

## 3. BLOCO — CONVERSÃO DE ORÇAMENTO EM VENDA

- **RB-86** — Hierarquia canônica:
  - **Lead** = pessoa/interessado
  - **Orçamento** = simulação específica de um lead (pode haver N por lead)
  - **Venda/Projeto** = nasce de **um orçamento escolhido**, nunca de "lead genérico"
- **RB-87** — Proibido converter usando **apenas `lead_id`**. Sempre exigir `_orcamento_id` quando a origem é um orçamento.
- **RB-88** — `_orcamento_id` deve ser preservado ponta-a-ponta: clique → modal → payload → RPC → registro final.
- **RB-89** — Modal de conversão exibe **"Converter ORC-XXXX em Venda"** (nunca "Converter Lead").
- **RB-90** — Formulário hidrata a partir do **orçamento selecionado** (cidade/UF/consumo/geração do orçamento têm prioridade sobre lead).
- **RB-91** — Mapeador único: `mapSelectedOrcamentoToConversionData(selectedOrcamento, lead)`. Header e formulário consomem a mesma fonte.
- **RB-92** — Financeiro herda **snapshot/condições reais** da proposta/orçamento (`proposta_versoes.snapshot.pagamentoOpcoes`).
- **RB-93** — Proibido assumir **Pix à vista** quando existe entrada / restante / parcelamento na proposta.

**Anti-padrões:**
- **AP-38** — Passar `{ id, orc_code, lead_id }` parcial ao modal.
- **AP-39** — `localStorage` com `{}` sobrescrevendo fallback do orçamento.

---

## 4. BLOCO — FORMULÁRIOS E HIDRATAÇÃO

- **RB-94** — React Hook Form **não pode depender só de `defaultValues`** quando o contexto (orçamento/lead) muda em runtime.
- **RB-95** — Usar **`hydrationKey`** por entidade/contexto + `lastResetKeyRef` para reset determinístico **uma vez por chave**.
- **RB-96** — Reset **NUNCA** pode sobrescrever digitação ativa do usuário (mesma chave = sem reset).
- **RB-97** — Proibido usar `localStorage` como SSOT de wizard. Pode ser cache, nunca verdade.
- **RB-98** — Limpar chaves legadas de `localStorage` quando existir fonte canônica (`mapSelected...`).
- **RB-99** — Header e formulário **devem usar o mesmo mapeador**. Diferença entre header preenchido e form vazio é bug crítico.

**Anti-padrões:**
- **AP-40** — `useEffect` com `form.reset` que só roda se `!isDirty` (perde hidratação inicial).
- **AP-41** — Múltiplas fontes de verdade competindo (initialData + localStorage + props).

---

## 5. BLOCO — FINANCEIRO / PROPOSTAS

- **RB-100** — Financeiro vem do **snapshot canônico** (`proposta_versoes.snapshot.pagamentoOpcoes` ou equivalente).
- **RB-101** — Entrada, saldo, número de parcelas e forma de pagamento **não podem ser perdidos** na conversão.
- **RB-102** — Proibido transformar pagamento parcelado/financiado em **Pix total**.
- **RB-103** — `total_alocado` **deve bater** com `valor_venda` (validação bloqueante na UI).
- **RB-104** — **Proposta aceita não pode ser apagada**. Apenas substituída (soft) com auditoria.
- **RB-105** — Total da proposta lido exclusivamente via `getCanonicalProposalTotal` (`services/proposal/proposalTotals.ts`). Nunca ler `valor_total` cru nem reimplementar `calcPrecoFinal`.
- **RB-106** — Alterações pós-venda exigem registro de auditoria (who / when / before / after).

**Anti-padrão:**
- **AP-42** — Inicializar `paymentItems` com `[createEmptyItem()]` (Pix à vista) ignorando `snapshot.pagamentoOpcoes`.

---

## 6. BLOCO — DOCUMENTOS E PENDÊNCIAS

- **RB-107** — Permitir **salvar pendente** quando faltar documento ou campo não-crítico. Nunca perder o preenchido.
- **RB-108** — Conversão pendente → projeto criado com status `aguardando_documentacao`. Conversão completa → fluxo normal.
- **RB-109** — Mínimo bloqueante para salvar pendente: **nome + telefone** (identificação do cliente). Tudo além disso é opcional.
- **RB-110** — Documentos anexados em modo pendente devem persistir (mesmos buckets, mesma estrutura).
- **RB-111** — Venda aceita **não bloqueia** enriquecimento posterior: CPF/CNPJ, endereço completo, UC, concessionária, dados técnicos e documentos podem ser completados depois.
- **RB-112** — Toda alteração pós-venda gera registro de auditoria (histórico visível ao usuário).

---

## 7. BLOCO — UX SAAS PREMIUM

- **RB-113** — Textos explicam **a ação real** ("Converter ORC-0102 em Venda", não "Converter Lead").
- **RB-114** — Proibido botão escondido como solução para fluxo crítico. CTA primário é visível.
- **RB-115** — Todo alerta tem CTA claro ("Anexar documento", "Completar CPF", etc.).
- **RB-116** — Proibido exibir **status contraditórios** (ex.: "Convertido" + "Aguardando aceite").
- **RB-117** — Proibido **duplicar badges** (uma fonte, uma badge).
- **RB-118** — Vocabulário correto: "Converter orçamento" ≠ "Converter lead". Auditar copy em modais, toasts, tabelas.
- **RB-119** — Estados de **loading / vazio / erro / skeleton** sempre presentes com mensagens claras.
- **RB-120** — Padrão visual: usar `<LoadingState />`, `border-l` semântico, `text-*-foreground` para safe dark mode. Detalhes em abas horizontais (nunca dropdown).

---

## 8. BLOCO — VALIDAÇÃO REAL

- **RB-121** — Proibida **"validação simulada"** para bugs visuais. Bug visual exige **print** ou validação manual real.
- **RB-122** — Build / typecheck **não prova UX**. Servem como pré-requisito, não como entrega.
- **RB-123** — Para bugs de dados, entregar **tabela "onde o dado existe × onde se perde"**.
- **RB-124** — Sempre indicar **arquivo:linha** da causa raiz na resposta.
- **RB-125** — Teste unitário do mapeador / função pura é obrigatório para correções de SSOT (ex.: `mapSelectedOrcamentoToConversionData.test.ts`).

---

## 9. BLOCO — SUPABASE / RLS / MULTI-TENANT

- **RB-126** — **RLS-first.** Toda tabela de domínio nasce com RLS ON e policies explícitas.
- **RB-127** — `tenant_id` obrigatório em toda tabela de domínio. Default e WITH CHECK via `auth.jwt() ->> 'tenant_id'`.
- **RB-128** — Edge Functions resolvem tenant via `auth.uid()` → `get_user_tenant_id()`. Nunca confiar em payload.
- **RB-129** — Proibido `service_role` no client para mascarar policy. Service role só em Edge Functions.
- **RB-130** — Proibido criar policy permissiva (`USING (true)`, `WITH CHECK (true)`) em tabela de domínio.
- **RB-131** — Proibido remover isolamento tenant para destravar bug. Bug de policy se resolve refinando policy, não removendo.
- **RB-132** — Antes de mexer em policy: auditar **payload + `auth.uid()` + `get_user_tenant_id()` + `WITH CHECK` + `USING`** e documentar o diff.
- **RB-133** — Funções `SECURITY DEFINER` exigem `SET search_path = public`.
- **RB-134** — Webhooks de edge function devem usar domínio `*.supabase.co` (nunca custom domain do app).

---

## 10. BLOCO — SUPRIMENTOS / ORDEM DE COMPRA

- **RB-135** — **Funil operacional ≠ status real da ordem.** Etapa Kanban é visualização; SSOT é `ordens_compra.status`.
- **RB-136** — Etapa "Pedido Pago" pode **sincronizar** com status `confirmada` quando seguro, **nunca** sobrescrever `recebida` / `recebida_parcial` / `cancelada`.
- **RB-137** — Editar fornecedor / pedido deve **atualizar** a ordem existente, nunca recriar.
- **RB-138** — `data_pedido`, previsão de entrega, valor e fornecedor são campos rastreáveis (auditoria + histórico).
- **RB-139** — Cancelamento / recebimento parcial não podem ser revertidos por arrastar card no Kanban.

**Anti-padrão:**
- **AP-43** — Trigger / handler que força `status = 'em_andamento'` ao mover etapa, apagando `recebida`.

---

## 11. DECISÕES DE ARQUITETURA (DA)

- **DA-49** — Hidratação de wizard usa `hydrationKey` + `lastResetKeyRef`. SSOT do conteúdo é o mapeador puro; RHF é apenas estado de UI.
- **DA-50** — Conversão de orçamento em venda **sempre** carrega `_orcamento_id`. RPC `convert_lead_to_venda_v2` aceita esse parâmetro e o persiste em `vendas.orcamento_id`.
- **DA-51** — Financeiro da conversão lê `proposta_versoes.snapshot.pagamentoOpcoes` da última versão aceita. Sem snapshot → `[createEmptyItem()]` com aviso explícito ao usuário.
- **DA-52** — Conversão pendente: novo parâmetro `_is_pending` em `convert_lead_to_venda_v2`. Quando true → `projetos.status = 'aguardando_documentacao'` e validações relaxadas (apenas nome + telefone obrigatórios).
- **DA-53** — Toda entrega da IA responde ao **Checklist Final Obrigatório** (§12). Resposta sem checklist é considerada incompleta.

---

## 12. CHECKLIST FINAL OBRIGATÓRIO

**Toda entrega da IA deve responder explicitamente:**

1. **Causa raiz real** (arquivo:linha)
2. **Arquivos alterados** (lista)
3. **SSOT usado** (qual mapeador / qual tabela / qual hook)
4. **O que NÃO foi alterado** (escopo negativo)
5. **Riscos residuais** (o que pode quebrar)
6. **Plano de rollback** (como reverter)
7. **Build / typecheck** (resultado)
8. **Validação visual / manual** (quando aplicável: print, passos para testar, ou explicitar "aguardando validação do usuário")

Entrega sem checklist → **rejeitada**.

---

## 13. CONVENÇÕES DE NUMERAÇÃO

- **RB-XX** — Regra Bloqueante (próxima livre: **RB-140**)
- **AP-XX** — Anti-Padrão (próxima livre: **AP-44**)
- **DA-XX** — Decisão de Arquitetura (próxima livre: **DA-54**)

Sempre adicionar novas regras no **final do bloco temático**, mantendo numeração crescente e sem reaproveitar números desativados (marcar como `[REVOGADO em DA-XX]`).

---

## 14. PRINCÍPIO FINAL

> **Diagnosticar antes de alterar.
> Provar antes de declarar.
> Preservar antes de reescrever.
> Auditar antes de migrar.**

Em caso de conflito entre velocidade e correção, **correção sempre vence**.
