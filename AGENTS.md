=============================================================================
AGENTS.md v4.0 — REGRAS MESTRAS DO PROJETO
Última atualização: 2026-04-24
Stack: React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui + React Query
Agente: Lovable
Tenant principal: 17de8315-2e2f-4a79-8751-e5d507d69a41
=============================================================================

BLOCO 0 — ÍNDICE RÁPIDO
- RB-01 a RB-58: Regras Bloqueantes (mantidas da v3.13)
- RB-59 a RB-75: NOVAS — Migração SolarMarket
- DA-43 a DA-47: NOVAS — Decisões arquiteturais de migração
- Bloco 24: NOVO — Fluxo completo de migração SM
- Checklist Bloco 9: ATUALIZADO com validações de migração

=============================================================================
BLOCO 1 — REGRAS BLOQUEANTES (RB-XX)
=============================================================================
NUNCA quebrar. Build falha, PR é rejeitado, código é revertido.

[MANTIDAS RB-01 a RB-58 da v3.13]

--- NOVAS RB v4.0 — MIGRAÇÃO SOLARMARKET ----------------------------------

RB-59 MIGRAÇÃO SM — PARIDADE FUNCIONAL OBRIGATÓRIA
Todo registro migrado do SolarMarket DEVE se comportar 100% igual a um
registro criado nativamente pela UI.
Critérios de validação obrigatórios:
- Abrir detalhe sem erro "não encontrado"
- Aparecer em kanbans, listas e buscas
- Permitir edição sem quebrar
- Acionar todas as triggers/automações
- Integrar com relatórios e filtros
- Card do kanban mostra R$, kWp, cliente
NUNCA deploy de migração sem validar com 1 registro nativo criado manualmente.
ANTES de codar migração: criar 1 cliente/projeto/proposta nativo como referência.

RB-60 MIGRAÇÃO SM — CADEIA OBRIGATÓRIA
Ao migrar um projeto, DEVE criar em cadeia (ordem obrigatória):
1. Cliente (se não existir) - SELECT antes de INSERT
2. Projeto (com external_source='solarmarket' + external_id)
3. Deal (OBRIGATÓRIO - sem deal = sem kanban comercial)
4. Vínculos funil_id + etapa_id (em projeto_funis/projeto_etapas)
5. external_entity_links (rastreabilidade)
NUNCA criar projeto sem deal.
NUNCA deixar funil_id ou etapa_id NULL.
NUNCA pular external_entity_links (quebra idempotência).

RB-61 MIGRAÇÃO SM — ARQUITETURA DUAL DE FUNIS
Sistema tem DOIS sistemas paralelos (decisão arquitetural - NÃO UNIFICAR):
- pipelines + pipeline_stages → mundo dos DEALS (kanban comercial)
- projeto_funis + projeto_etapas → mundo dos PROJETOS (kanban execução)
Ao migrar:
- deals.pipeline_id → pipelines.id
- deals.stage_id → pipeline_stages.id
- projetos.funil_id → projeto_funis.id
- projetos.etapa_id → projeto_etapas.id
SEMPRE manter espelho: cada pipeline tem projeto_funis correspondente.
sm-criar-pipeline-auto deve criar AMBOS em paralelo.
NUNCA gravar pipeline_id em projetos.funil_id (mundos diferentes).

RB-62 MIGRAÇÃO SM — FORMATAÇÃO NATIVA OBRIGATÓRIA
Ao migrar, aplicar formatação idêntica ao fluxo nativo:
- Telefone: "(XX) XXXXX-XXXX" + telefone_normalized só números
- CPF: "XXX.XXX.XXX-XX"
- CNPJ: "XX.XXX.XXX/XXXX-XX"
- CEP: "XXXXX-XXX"
- Nome: capitalize cada palavra ("João Silva" não "JOÃO SILVA")
- Email: lowercase + trim
- Endereço: SEPARAR em rua + número + bairro + cidade + estado + CEP
Se valor vier sujo do SM, NORMALIZAR antes de inserir.
NUNCA gravar dado sem formatação se campo nativo tem formato.
Helper centralizado: src/lib/migrationFormatters.ts

RB-63 MIGRAÇÃO SM — VALIDAÇÃO PRÉ-INSERT
Antes de inserir, validar:
- CPF/CNPJ formato válido? Se não, guardar raw em observacoes + NULL no campo
- Email tem @ e domínio? Se não, NULL
- Telefone tem 10-11 dígitos? Se não, NULL
- Endereço tem CEP? Se não, marcar como incompleto
- Nome obrigatório? Se vazio, BLOQUEAR migração desse registro
NUNCA inserir registro com campos críticos inválidos silenciosamente.
SEMPRE log em solarmarket_promotion_logs todos os descartes/blocks.

RB-64 MIGRAÇÃO SM — IDEMPOTÊNCIA VIA SSOT
external_entity_links é SSOT (Single Source of Truth) de idempotência.
Rodar migração N vezes DEVE produzir o mesmo resultado final.
ANTES de INSERT: SELECT em external_entity_links para checar existência.
Ao editar: UPDATE existente, NUNCA duplicar.
NUNCA criar registros duplicados por dedup fraco.
Padrão obrigatório:
  SELECT entity_id FROM external_entity_links
  WHERE source='solarmarket' AND source_entity_type='X' AND source_entity_id=Y;

RB-65 MIGRAÇÃO SM — FLUXO CORRETO OBRIGATÓRIO
Ordem de execução (NÃO PULAR ETAPAS):
1. sm-import → popular sm_*_raw (staging) - TODAS as 6 tabelas
2. sm-criar-pipeline-auto → criar pipelines + projeto_funis espelho
3. sm-promote → clientes + projetos + propostas (esqueletos)
4. sm-enrich-versoes → valor, potência, kit, UCs, localização
5. sm-promote-custom-fields → custom fields + arquivos
NUNCA pular sm-enrich-versoes (sem ela: card vazio, R$ NULL).
NUNCA pular sm-criar-pipeline-auto (sem ela: funil_id NULL).
NUNCA rodar fora de ordem.
Validação entre etapas: cada step DEVE confirmar conclusão da anterior.

RB-66 MIGRAÇÃO SM — JOBS ÓRFÃOS DEVEM SER CANCELADOS
Jobs em solarmarket_promotion_jobs com:
- status='running' E last_step_at IS NULL E created_at < now() - 5min
DEVEM ser marcados como 'cancelled' automaticamente.
Cron sm_resume_stuck_migrations já faz isso (ver pg_cron).
NUNCA deixar jobs órfãos bloqueando novos disparos.
ANTES de iniciar nova migração: query de validação de jobs ativos.

RB-67 MIGRAÇÃO SM — PROPAGAR VALOR/POTÊNCIA EM CASCATA
Valor e potência estão em sm_propostas_raw.payload.variables:
- payload.variables[key='preco'] → proposta_versoes.valor_total → projetos.valor_total
- payload.variables[key='potencia_sistema'] → proposta_versoes.potencia_kwp → projetos.potencia_kwp
- payload.variables[key='modulo_quantidade'] → projetos.numero_modulos
- payload.variables[key='modulo_fabricante'] + modulo_modelo → projetos.modelo_modulos
- payload.variables[key='inversor_fabricante'] + inversor_modelo → projetos.modelo_inversor
sm-enrich-versoes DEVE atualizar AMBAS as tabelas em cascata:
  proposta_versoes.X → projetos.X (via projeto_id)
Card do kanban lê de projetos — se projetos.valor_total=0, card mostra "R$ —".

RB-68 MIGRAÇÃO SM — MATCH STAGING vs CANÔNICO COM PREFIX
sm_propostas_raw._sm_proposal_id pode ter formato "10:2" (proposta_id:projeto_id).
propostas_nativas.external_id pode ter só "10".
SEMPRE usar split_part(_sm_proposal_id, ':', 1) no JOIN.
NUNCA fazer match exato direto — vai retornar 0 linhas silenciosamente.
Padrão obrigatório:
  JOIN sm_propostas_raw sr
  ON split_part(sr.payload->>'_sm_proposal_id', ':', 1) = pn.external_id

RB-69 MIGRAÇÃO SM — CONSULTAR AGENTS.md ANTES DE CODAR
Ao receber tarefa relacionada a migração SolarMarket:
1. LER AGENTS.md seção "Migração SM" (RB-52, RB-57, RB-58, RB-59 a RB-75)
2. VALIDAR se solução proposta viola alguma RB
3. Se violar: REPORTAR ao usuário antes de implementar
4. Se não violar: implementar e referenciar RB no commit message
NUNCA implementar solução que contradiga AGENTS.md sem aviso prévio.
SEMPRE incluir no commit: "ref: RB-XX, RB-YY"

RB-70 MIGRAÇÃO SM — DRY-RUN OBRIGATÓRIO EM PRODUÇÃO
Antes de rodar migração em massa em ambiente de produção:
1. Executar dry_run=true primeiro
2. Validar report.bloqueados = 0
3. Validar report.warnings revisados
4. Só então rodar dry_run=false
NUNCA migrar 1000+ registros sem dry-run validado.
NUNCA ignorar warnings sem documentar motivo.

RB-71 MIGRAÇÃO SM — CHUNKS PEQUENOS PARA EVITAR MEMORY CRASH
Edge functions têm limite de memória (128MB Deno isolate).
Carregar 1000+ payloads JSONB de uma vez = crash silencioso.
SEMPRE processar em chunks:
- sm-promote: máximo 25 registros por chunk
- sm-enrich-versoes: máximo 25 registros por chunk
- sm-promote-custom-fields: máximo 20 registros por chunk
- Auto-encadeamento via EdgeRuntime.waitUntil
NUNCA tentar processar tudo em 1 invocação.
SEMPRE retornar next_offset para continuar.

RB-72 MIGRAÇÃO SM — UI DEVE CHAMAR ENDPOINT CHUNKED
Frontend NUNCA deve chamar sm-promote diretamente.
SEMPRE usar sm-migrate-chunk (orquestrador com chunks).
Bug histórico: UI chamando sm-promote com batch_limit=10000 = memory crash.
Validação: useMigrateFull/useStartMigration deve chamar sm-migrate-chunk.

RB-73 MIGRAÇÃO SM — RESPEITAR PIPELINES EXISTENTES DO TENANT
NUNCA criar pipelines automaticamente em tenant que JÁ TEM pipelines.
ANTES de criar: SELECT count em pipelines WHERE tenant_id=X.
Se tenant tem >0 pipelines:
- NÃO auto-criar pipelines SM
- Permitir admin MAPEAR pipelines SM aos existentes
- Step 2 manual obrigatório
Se tenant tem 0 pipelines (novo):
- Pode criar os 4 padrão (Comercial, Engenharia, Equipamento, Compensação)
- Pedir confirmação antes
NUNCA bagunçar CRM existente do cliente.

RB-74 MIGRAÇÃO SM — RESET RESPEITA SCHEMA REAL
Função sm-reset-all DEVE usar nomes corretos de colunas:
- clientes.external_source ✓
- projetos.external_source ✓
- propostas_nativas.external_source ✓
- deals: NÃO TEM external_source — filtrar via JOIN com projetos
- external_entity_links.source (não external_source)
NUNCA assumir que coluna 'external_source' existe em todas as tabelas.
SEMPRE verificar information_schema antes.

RB-75 MIGRAÇÃO SM — LOGS ESTRUTURADOS, NÃO VERBOSE
Edge functions de migração geram MUITOS logs.
Limite Supabase: ~1000 logs/edge invocation antes de truncate.
PERMITIDO em produção:
- console.error com prefixo do módulo + erro
- console.warn com prefixo + warning crítico
- 1 summary final por chunk
NÃO PERMITIDO:
- console.log por registro processado
- console.log de cada step interno
- console.log de payloads completos
Para debug: usar DEBUG=true via env var, condicional no código.

=============================================================================
BLOCO 2 — BOAS PRÁTICAS [mantidas v3.13]
=============================================================================

=============================================================================
BLOCO 3 — SNIPPETS OBRIGATÓRIOS [mantidos v3.13]
=============================================================================

=============================================================================
BLOCO 4 — ANTI-PADRÕES (AP-XX) [mantidos v3.13]
=============================================================================

--- NOVOS AP v4.0 — MIGRAÇÃO SM ------------------------------------------

AP-30 MIGRAÇÃO SEM CRIAR DEAL
✗ Errado: INSERT INTO projetos sem criar deal correspondente
✓ Certo: cliente → projeto → deal → vínculos funil/etapa

AP-31 USAR PIPELINE_ID EM PROJETOS.FUNIL_ID
✗ Errado: gravar UUID de pipelines.id em projetos.funil_id
✓ Certo: usar projeto_funis.id (sistema dual)

AP-32 MATCH EXATO EM _SM_PROPOSAL_ID
✗ Errado: WHERE _sm_proposal_id = '10' (mas staging tem '10:2')
✓ Certo: WHERE split_part(_sm_proposal_id, ':', 1) = '10'

AP-33 PULAR ENRICH-VERSOES
✗ Errado: rodar sm-promote sem sm-enrich-versoes depois
✓ Certo: pipeline completo (5 etapas em ordem)

AP-34 MIGRAR SEM FORMATAR
✗ Errado: gravar telefone "32988887777" sem formatação
✓ Certo: aplicar formatPhoneBR antes de gravar

=============================================================================
BLOCO 5 — DECISÕES ARQUITETURAIS (DA-XX) [mantidas DA-01 a DA-42]
=============================================================================

--- NOVAS DA v4.0 — MIGRAÇÃO SM ------------------------------------------

DA-43 MIGRAÇÃO SM — PROPOSTAS MAPEADAS POR PREFIXO
sm_propostas_raw._sm_proposal_id tem formato "proposta_id:projeto_id".
A parte antes do ":" é o identificador canônico usado em external_id.
Decisão: usar split_part em JOINs (RB-68).
Motivo: SolarMarket API retorna ID composto; não alteramos staging.

DA-44 MIGRAÇÃO SM — 25 REGISTROS POR CHUNK
Chunks de 25 em sm-migrate-chunk é o equilíbrio entre:
- Timeout de edge function (max 60s)
- Quantidade de queries por registro (~5-10 N+1)
- Memória disponível em Deno isolate (128MB)
Decisão: manter 25 até otimizar N+1 em sm-promote (cache + bulk insert).
Motivo: chunks maiores estouram memória; menores aumentam overhead.

DA-45 MIGRAÇÃO SM — CUSTOM FIELDS VIA DEAL_ID
deal_custom_field_values.deal_id aponta para deals.id (não projetos.id).
Decisão: criar deals antes de popular custom fields.
Motivo: arquitetura nativa vincula custom fields a deals.
Sequência obrigatória: projetos → deals → deal_custom_field_values.

DA-46 MIGRAÇÃO SM — ARQUIVOS SOBEM PARA STORAGE PRÓPRIO
URLs externas de arquivos (RG, comprovante endereço) em sm_propostas_raw
são baixadas e armazenadas em bucket 'imported-files'.
Path: sm/{tenant_id}/{deal_id}/{field_key}/{filename}
Idempotente: skip se já existe.
NUNCA manter URL externa do SolarMarket (vai quebrar quando SM cair).

DA-47 MIGRAÇÃO SM — SCHEMA DUAL FUNIL/PIPELINE — DEFINITIVO
Sistema tem dois mundos paralelos por design:
- Comercial (deals + pipelines): negociação, valores, propostas
- Execução (projetos + projeto_funis): instalação, vistoria, comissionamento
Decisão: NÃO unificar. Cada um tem propósito distinto.
Motivo: separation of concerns; usuários diferentes acessam cada kanban.

=============================================================================
BLOCO 6-8 — [mantidos v3.13]
=============================================================================

=============================================================================
BLOCO 9 — CHECKLIST DE PR [ATUALIZADO v4.0]
=============================================================================

[Mantido checklist da v3.13]

NOVO — CHECKLIST ESPECÍFICO DE MIGRAÇÃO SM:
[ ] Staging populado em TODAS as 6 tabelas
[ ] projeto_funis = pipelines (espelho criado)
[ ] 0 jobs órfãos em solarmarket_promotion_jobs
[ ] Dry-run executado e report validado (bloqueados=0)
[ ] Promote em chunks (sem timeout, sem memory crash)
[ ] Enrich rodado até processed=0
[ ] Custom fields + arquivos baixados
[ ] 1 cliente/projeto/proposta NATIVO criado para comparação
[ ] Query de validação: campos críticos > 0% NULL
[ ] Teste manual: abrir projeto sem erro "não encontrado"
[ ] Teste manual: card kanban mostra R$, kWp, cliente
[ ] Teste manual: aba Propostas lista com kit completo
[ ] Teste manual: edição funciona
[ ] Validar formatação: telefones com (XX) XXXXX-XXXX
[ ] Validar formatação: CPFs com XXX.XXX.XXX-XX

=============================================================================
BLOCO 10-22 — [mantidos v3.13]
=============================================================================

RB-89 STORAGE — BUCKET ÚNICO POR DOMÍNIO
O sistema possui os seguintes buckets canônicos:
- projeto-documentos  → documentos de projetos e campos customizados
- credit-documents    → documentos de análise de crédito
- generated-documents → contratos e fichas gerados pelo sistema
- imported-files      → arquivos importados do SolarMarket
- recibos             → recibos financeiros de projetos
NUNCA criar novo bucket sem declarar aqui.
NUNCA usar nome em inglês se o bucket canônico é em português.
SEMPRE usar o helper getStorageBucket(origem) para determinar o bucket.
NUNCA hardcodar string de bucket no componente.
Helper canônico em src/lib/storage.ts.

BIBLIOTECA CANÔNICA DE FORMATAÇÃO:
src/lib/formatters/index.ts → SSOT de todas as funções (formatBRL, formatCPF, formatPhoneBR, displayCurrency, etc).
src/components/ui-kit/inputs/ → Componentes padronizados (CpfCnpjInput, PhoneInput, CurrencyInput, DateInput, CepInput).

PROIBIDO:
- Implementar máscara inline no componente.
- Duplicar função de formatação.
- Usar biblioteca externa de máscara (react-input-mask, imask, etc) — usar formatters/index.ts.

OBRIGATÓRIO em qualquer novo formulário:
- Importar de src/lib/formatters/index.ts.
- Usar componentes de src/components/ui-kit/inputs/.
- NUNCA criar input de CPF/telefone/CEP do zero.


=============================================================================
BLOCO 23 — CORREÇÕES E MELHORIAS v3.13 [mantido]
=============================================================================

=============================================================================
BLOCO 24 — NOVO v4.0 — FLUXO COMPLETO DE MIGRAÇÃO SM
=============================================================================

DIAGNÓSTICO RÁPIDO:
Antes de migrar QUALQUER coisa, validar estado atual:

```sql
-- 1. Jobs órfãos (devem ser 0)
SELECT COUNT(*) FROM solarmarket_promotion_jobs
WHERE status='running' AND (last_step_at IS NULL OR last_step_at < now() - interval '5 min');

-- 2. Staging populado (devem ter dados)
SELECT
  (SELECT COUNT(*) FROM sm_clientes_raw WHERE tenant_id=X) AS clientes,
  (SELECT COUNT(*) FROM sm_projetos_raw WHERE tenant_id=X) AS projetos,
  (SELECT COUNT(*) FROM sm_propostas_raw WHERE tenant_id=X) AS propostas,
  (SELECT COUNT(*) FROM sm_funis_raw WHERE tenant_id=X) AS funis;

-- 3. Pipelines existentes (decidir auto-criar ou não)
SELECT COUNT(*) FROM pipelines WHERE tenant_id=X;
SELECT COUNT(*) FROM projeto_funis WHERE tenant_id=X;
```

FLUXO COMPLETO (5 FASES):

FASE 0 — Higiene (1 min)
- Cancelar jobs órfãos
- Validar staging populado

FASE 1 — Bootstrap pipelines (5-10 min)
- Se tenant vazio: criar 4 pipelines padrão + espelho projeto_funis
- Se tenant tem: admin mapeia manualmente
- Validar: projeto_funis = pipelines

FASE 2 — Promote esqueletos (30-45 min)
- sm-migrate-chunk em chunks de 25
- Cria: clientes + projetos + deals + propostas (estruturas básicas)
- Idempotente via external_entity_links
- Auto-encadeamento via EdgeRuntime.waitUntil

FASE 3 — Enrich versões (15-20 min)
- sm-enrich-versoes em loop até processed=0
- Popula: valor_total, potencia_kwp, payback, TIR, VPL
- Cria: kit + itens + UCs + localização do projeto
- Sobrescreve sempre (idempotente)

FASE 4 — Custom fields (10-15 min)
- sm-promote-custom-fields em chunks
- Popula: deal_custom_field_values
- Baixa: RG, comprovante endereço para Storage
- Idempotente

FASE 5 — Validação (10 min)
- Query de validação por entidade
- Teste manual em 1 registro
- Comparação com nativo

VALIDAÇÃO PÓS-MIGRAÇÃO:

```sql
-- Cliente
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE telefone ~ '^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$') AS tel_ok,
  COUNT(*) FILTER (WHERE cep IS NOT NULL AND rua IS NOT NULL) AS endereco_ok
FROM clientes WHERE external_source='solarmarket';

-- Projeto
SELECT
  COUNT(*) AS total,
  COUNT(deal_id) AS com_deal,
  COUNT(funil_id) AS com_funil,
  COUNT(*) FILTER (WHERE valor_total > 0) AS com_valor
FROM projetos WHERE external_source='solarmarket';

-- Proposta + versão
SELECT
  COUNT(DISTINCT pn.id) AS propostas,
  COUNT(DISTINCT pv.id) AS versoes,
  COUNT(DISTINCT pk.id) AS kits,
  COUNT(DISTINCT puv.id) AS ucs
FROM propostas_nativas pn
LEFT JOIN proposta_versoes pv ON pv.proposta_id=pn.id
LEFT JOIN proposta_kits pk ON pk.versao_id=pv.id
LEFT JOIN proposta_versao_ucs puv ON puv.versao_id=pv.id
WHERE pn.external_source='solarmarket';
```

CRITÉRIO DE ACEITE:
- 95%+ clientes com telefone formatado
- 95%+ projetos com deal_id e funil_id
- 95%+ projetos com valor_total > 0
- 100% propostas com pelo menos 1 versão + kit + UC

=============================================================================
BLOCO 25 — NOVO v4.1 — CENTRAL DE INTEGRAÇÕES SEM DUPLICAÇÃO
=============================================================================

RB-76 CENTRAL DE INTEGRAÇÕES — AUDITAR ANTES DE CRIAR
Antes de criar qualquer página, hook, service ou tabela de integração:
1. Auditar se já existe página equivalente (rg em src/pages e src/components/admin).
2. Auditar se já existe tabela equivalente (information_schema / types.ts).
3. Auditar se já existe hook/service equivalente (rg em src/hooks e src/services).
4. Preferir alias de rota antes de mover componente.
5. Preferir reaproveitar tabela existente antes de criar nova.
6. PROIBIDO criar system_integrations_config genérico se já houver tabela específica.
7. PROIBIDO duplicar configuração de WhatsApp, IA, SolarMarket ou Conexões.
8. Toda nova tela de integração DEVE declarar no topo (comentário) quais
   tabelas existentes reaproveita e quais componentes encapsula.
9. Toda entrega DEVE ser faseada por domínio (WhatsApp, SolarMarket, IA,
   Conexões — nunca tudo junto).
10. PROIBIDO implementar "tudo em uma entrega". Fases curtas, validáveis.

DA-48 INTEGRAÇÕES USAM CATÁLOGO COMO SHELL CENTRAL
- IntegrationsCatalogPage em /admin/catalogo-integracoes é o shell central.
- A rota /admin/integracoes continua apontando para ele (redirect).
- Novas áreas devem ser organizadas via menu/submenu e aliases de rota
  sob /admin/integracoes/{dominio}/{secao}.
- NÃO criar segunda central paralela.
- Páginas wrapper finas (≤30 linhas) são preferíveis a duplicar componente.

=============================================================================
BLOCO 26 — DOMÍNIO CRÉDITO & FINANCIAMENTO (v1.0 — concluído)
=============================================================================

ARQUITETURA DO DOMÍNIO:
Motor central: Bank Operations Core
Componente principal: CreditGlobalArea.tsx (/admin/credit/global)
Portal consultor: VendorCreditoView.tsx (/consultor/credito)
Configuração: CreditConfigPage.tsx (/admin/configuracoes/credito)
Integração EOS: /admin/integracoes/financeiras/eos

TABELAS CANÔNICAS (NÃO DUPLICAR):
- analise_credito          → tabela principal, equivale a credit_requests
- credit_analysis_events   → log imutável de todas as ações (correlation_id)
- credit_simulations       → histórico de simulações
- credit_bank_configs      → SSOT de bancos/financeiras (substituiu financiamento_bancos)
- credit_bank_checklists   → documentos exigidos por banco
- credit_workflow_configs  → configurações de fluxo
- credit_operation_jobs    → fila de jobs de integração
- credit_operation_logs    → log de execução de jobs e erros de API
- analise_credito_documentos → documentos vinculados à análise
- financeiras_config       → credenciais OAuth por tenant (RLS restrito a admin)

TABELAS DEPRECIADAS (NÃO REFERENCIAR):
- _deprecated_financiamento_bancos → migrada para credit_bank_configs

HOOKS CANÔNICOS (NÃO DUPLICAR):
- useAnaliseCredito
- useCreditDomain
- useCreditConfigs
- useCreditMetrics
- useCreateAnaliseCredito (com idempotency_key)
- useFinanciamentoBancos  → adapter sobre credit_bank_configs (manter para compatibilidade)

EDGE FUNCTIONS DE INTEGRAÇÃO EOS:
- eos-get-token      → OAuth client_credentials, token em memória (nunca no banco)
- eos-simular        → simulação com validação CPF/CNPJ antes de chamar API
- eos-enviar-proposta → submissão com mapeamento cliente+projeto+financiamento

FLUXO DE STATUS (analise_credito.status):
rascunho
  → aguardando_analise    (consultor submete)
    → aprovado_interno     (gerente aprova)
      → simulacao_concluida (EOS simula)
        → enviado_financeira (EOS recebe proposta)
    → reprovado            (gerente reprova — exige motivo ≥ 20 chars)
    → aguardando_documentos (gerente solicita docs)
      → aguardando_analise  (consultor resubmete)

REGRAS BLOQUEANTES ESPECÍFICAS DO DOMÍNIO:

RB-77 CRÉDITO — IDEMPOTÊNCIA VIA IDEMPOTENCY_KEY
useCreateAnaliseCredito usa idempotency_key baseada em projeto_id.
NUNCA criar duas análises para o mesmo projeto sem checar existência.
SEMPRE verificar analise_credito WHERE projeto_id antes de INSERT.

RB-78 CRÉDITO — EVENTOS SÃO IMUTÁVEIS
credit_analysis_events NUNCA recebe UPDATE ou DELETE.
Toda correção é um novo evento do tipo 'correcao' com referência ao evento anterior.
NUNCA modificar evento existente.

RB-79 CRÉDITO — CREDENCIAIS EOS NUNCA NO FRONTEND
financeiras_config.api_credentials (JSONB com client_secret) só é lido
por Edge Functions via service role.
NUNCA retornar api_credentials para o cliente React.
NUNCA logar client_secret em credit_operation_logs.

RB-80 CRÉDITO — VALIDAR ANTES DE CHAMAR API EOS
Antes de qualquer chamada a eos-simular ou eos-enviar-proposta:
- CPF/CNPJ: algoritmo checksum (isValidCpf / isValidCnpj)
- Valor > 0
- Prazo entre 12 e 120
- Email com @ e domínio
- Telefone com 10-11 dígitos
Se inválido: retornar 422, gravar em credit_operation_logs, NUNCA chamar API.

RB-81 CRÉDITO — EXPORTAÇÃO SEM EDGE FUNCTION
Exportação Excel (.xlsx via SheetJS) e PDF (window.print()) são gerados
no frontend com dados já carregados.
NUNCA criar Edge Function para geração de relatório de crédito.
Dados sensíveis (client_secret, tokens) NUNCA incluídos na exportação.

ANTI-PADRÕES ESPECÍFICOS:
AP-35 CRIAR NOVA TABELA DE BANCOS
✗ Errado: CREATE TABLE financiamento_parceiros ou similar
✓ Certo: INSERT INTO credit_bank_configs

AP-36 CRIAR NOVO HOOK DE MÉTRICAS
✗ Errado: useCreditReportMetrics, useDashboardCredito
✓ Certo: reaproveitar useCreditMetrics com filtros como parâmetro

AP-37 GRAVAR TOKEN EOS NO BANCO
✗ Errado: INSERT INTO financeiras_config (access_token)
✓ Certo: token em memória da Edge Function, renovar via expires_in

AP-38 NOVA PÁGINA DE RELATÓRIO
✗ Errado: /admin/relatorios/credito (página nova)
✓ Certo: aba "Relatórios" dentro de CreditGlobalArea.tsx

CHECKLIST DE PR PARA FEATURES DE CRÉDITO:
[ ] Nenhuma das tabelas depreciadas referenciada
[ ] Evento gravado em credit_analysis_events com correlation_id
[ ] Idempotência verificada antes de INSERT em analise_credito
[ ] client_secret não trafega pelo frontend
[ ] CPF/CNPJ validado por checksum antes de qualquer INSERT ou chamada API
[ ] useCreditMetrics reaproveitado (não duplicado)
[ ] Comentário no topo do componente declarando tabelas e hooks usados

=============================================================================
BLOCO 27 — REGRAS DE FORMULÁRIO E VALIDAÇÃO (v1.0)
=============================================================================

RB-82 FORMULÁRIOS — VALIDAÇÃO ANTES DE AVANÇAR
Todo wizard/formulário com múltiplos passos DEVE:
- Bloquear botão "Próximo" até todos os obrigatórios válidos
- Exibir erros INLINE abaixo de cada campo (não só toast)
- NUNCA enviar dados inválidos para o banco
- NUNCA enviar string vazia para campo tipado (date, number, uuid)
Padrão: validar no onBlur + no clique de "Próximo".

RB-83 FORMULÁRIOS — MÁSCARAS OBRIGATÓRIAS EM TEMPO REAL
Campos com formato fixo DEVEM aplicar máscara no onChange:
- CPF:   XXX.XXX.XXX-XX      (11 dígitos)
- CNPJ:  XX.XXX.XXX/XXXX-XX  (14 dígitos)
- CEP:   XXXXX-XXX            (8 dígitos)
- Fone:  (XX) XXXXX-XXXX      (10-11 dígitos)
- Moeda: R$ X.XXX,XX          (formato PT-BR)
- kWp:   aceitar vírgula ou ponto como decimal
NUNCA exibir campo de CPF/CNPJ sem máscara.
NUNCA exibir valor monetário sem prefixo R$ e separador de milhar.
Biblioteca recomendada: react-input-mask ou implementação própria.

RB-84 FORMULÁRIOS — DATAS SEMPRE EM ISO NO BANCO
Campos de data DEVEM:
- Exibir para o usuário: DD/MM/AAAA (formato PT-BR)
- Salvar no banco: YYYY-MM-DDT00:00:00.000Z (ISO 8601)
- NUNCA salvar string vazia em campo DATE/TIMESTAMPTZ
- NUNCA salvar data sem validar se é uma data real
- Validar: new Date(value).toString() !== 'Invalid Date'
Conversão obrigatória antes de qualquer INSERT/UPDATE:
  const iso = new Date(yyyy, mm-1, dd).toISOString()

RB-85 FORMULÁRIOS — VALORES MONETÁRIOS EM DECIMAL NO BANCO
Campos de valor R$ DEVEM:
- Exibir: R$ 8.918,53 (formato PT-BR com vírgula decimal)
- Salvar: 8918.53 (DECIMAL com ponto, sem R$ e sem separador de milhar)
- NUNCA salvar string "R$ 8.918,53" em campo DECIMAL
Conversão obrigatória:
  const decimal = parseFloat(value.replace(/\./g, '').replace(',', '.'))

RB-86 FORMULÁRIOS — CEP DISPARA AUTOCOMPLETE
Campo CEP DEVE:
- Ao completar 8 dígitos: chamar https://viacep.com.br/ws/{cep}/json/
- Preencher automaticamente: logradouro, bairro, cidade, estado
- Mostrar loading durante a consulta
- Se CEP inválido: exibir erro inline
- Campos preenchidos pelo CEP ficam editáveis (não readonly)
NUNCA deixar usuário preencher cidade/estado manualmente
sem antes tentar o auto-complete via CEP.

RB-87 FORMULÁRIOS — CPF/CNPJ COM CHECKSUM
Validação de CPF e CNPJ DEVE usar algoritmo de checksum completo.
NÃO validar só formato (quantidade de dígitos).
CPFs como 111.111.111-11 passam no formato mas FALHAM no checksum.
Usar funções canônicas: isValidCpf() e isValidCnpj()
de src/lib/validators.ts (criar se não existir).
NUNCA aceitar CPF/CNPJ inválido no banco.

AP-39 AVANÇAR WIZARD SEM VALIDAR
✗ Errado: permitir "Próximo" com campos obrigatórios vazios
✓ Certo: validar todos os campos do passo atual antes de avançar

AP-40 DATA COMO STRING VAZIA
✗ Errado: INSERT INTO tabela (data_nascimento) VALUES ('')
✓ Certo: validar → converter → INSERT VALUES ('1990-01-25T00:00:00.000Z')

AP-41 MOEDA SEM CONVERSÃO
✗ Errado: INSERT INTO tabela (valor) VALUES ('R$ 8.918,53')
✓ Certo: parseFloat('8.918,53'.replace(/\./g,'').replace(',','.')) → 8918.53

AP-42 CEP SEM AUTOCOMPLETE
✗ Errado: usuário digita cidade e estado manualmente
✓ Certo: CEP completo → ViaCEP → preencher campos automaticamente

=============================================================================
BLOCO 28 — DOMÍNIO FORNECEDORES & ORDENS DE COMPRA (v1.0)
=============================================================================

ARQUITETURA DO DOMÍNIO:
Tabela principal: fornecedores (CRUD em /admin/fornecedores)
Tabela de pedidos: ordens_compra (fornecedor_id + projeto_id)
Componente modal: VincularFornecedorModal.tsx
Interceptor: LeadsPipeline.tsx → handleDrop
Visibilidade: KanbanCard.tsx → FornecedorPedidoInfo
Gestão: SuprimentosListPage.tsx

TABELAS CANÔNICAS (NÃO DUPLICAR):
- fornecedores:
    id, tenant_id, nome, cnpj, email, telefone
    tipo (distribuidor/fabricante/integrador)
    categorias[], ativo
    RLS: por tenant_id
- ordens_compra:
    id, tenant_id, projeto_id, fornecedor_id
    numero_pedido, valor_total, previsao_entrega
    status, observacoes, created_by
    RLS: por tenant_id

STATUS DE ORDEM (fluxo obrigatório):
  pedido_efetuado → deposito_pago → entregue
  (cancelado em qualquer etapa)

REGRA DO INTERCEPTOR:
RB-90 FUNIL EQUIPAMENTO — FORNECEDOR OBRIGATÓRIO
Ao avançar projeto para etapa "Pedido Efetuado":
DEVE abrir VincularFornecedorModal antes de confirmar.
NUNCA avançar etapa sem criar registro em ordens_compra.
Se já existe ordem: mostrar confirmação simples.
Se cancelar modal: card retorna posição anterior.
Evento obrigatório em histórico: 'fornecedor_vinculado'

RB-91 ORDENS DE COMPRA — VÍNCULO OBRIGATÓRIO
ordens_compra SEMPRE tem projeto_id + fornecedor_id.
NUNCA criar ordem sem vínculo com projeto.
NUNCA criar ordem sem fornecedor cadastrado em fornecedores.
Para novo fornecedor: cadastrar em fornecedores primeiro.

AP-44 CRIAR FORNECEDOR_ID EM PROJETOS
✗ Errado: adicionar coluna fornecedor_id direto em projetos
✓ Certo: usar ordens_compra como tabela de relacionamento
  (projeto pode ter múltiplos fornecedores)

AP-45 AVANÇAR ETAPA SEM FORNECEDOR
✗ Errado: handleDrop avança direto para "Pedido Efetuado"
✓ Certo: interceptar → modal → INSERT ordens_compra → avançar

CHECKLIST DE PR PARA FEATURES DE FORNECEDOR:
[ ] VincularFornecedorModal reutilizado (não duplicado)
[ ] ordens_compra tem projeto_id + fornecedor_id
[ ] RLS ativo por tenant_id
[ ] Evento gravado em histórico do projeto
[ ] Card do kanban exibe fornecedor após vinculação
[ ] SuprimentosListPage lista ordens do projeto

=============================================================================
BLOCO 29 — PORTAL DO CONSULTOR (v1.0)
=============================================================================

ARQUITETURA:
Shell: VendedorPortal.tsx (/consultor/*)
Sidebar: vendorSidebarConfig.ts
Dashboard: VendorDashboard ou similar
Leads: VendorOrcamentosView.tsx
Crédito: VendorCreditoView.tsx
WhatsApp: /consultor/whatsapp

REGRAS DE ISOLAMENTO (CRÍTICO):
RB-92 PORTAL CONSULTOR — FILTRO OBRIGATÓRIO auth.uid()
TODA query no portal do consultor DEVE filtrar por:
  consultor_id = auth.uid() OU criado_por = auth.uid()
NUNCA retornar dados de outros consultores.
NUNCA usar query sem filtro de ownership no portal.
RLS obrigatório em analise_credito, leads, lead_atividades.

RB-93 PORTAL CONSULTOR — BADGES APENAS DE AÇÃO
Badges no menu do consultor SOMENTE para ação necessária:
  Leads: urgentes (sem contato +3 dias) — NÃO total
  Agenda: tarefas vencidas/hoje — NÃO total
  Crédito: aguardando documentos — NÃO total
  Atendimento: conversas não respondidas
NUNCA badge de total de registros (não é ação).

FUNCIONALIDADES IMPLEMENTADAS:
- Busca CPF → pré-preencher ficha de crédito
- Leads disponíveis (sem consultor) → auto-atribuição
- Widget comissões (percentual_comissao em profiles)
- Projetos em execução com alerta +7 dias parado
- Fila de crédito filtrada por consultor_id

AP-46 CONSULTOR VER DADOS DE OUTRO
✗ Errado: query em analise_credito sem WHERE consultor_id
✓ Certo: .eq('consultor_id', auth.uid()) em toda query

AP-47 BADGE DE TOTAL NO MENU
✗ Errado: badge mostrando "45" (total de orçamentos)
✓ Certo: badge mostrando "3" (urgentes que precisam de ação)

CHECKLIST DE PR PARA FEATURES DO PORTAL:
[ ] Toda query filtra por auth.uid()
[ ] RLS verificado nas tabelas envolvidas
[ ] Badge representa ação (não total)
[ ] Dados de comissão via percentual_comissao de profiles
[ ] Leads disponíveis filtram consultor_id IS NULL

=============================================================================
BLOCO 30 — GERAÇÃO DE DOCUMENTOS (v1.0)
=============================================================================

RB-94 STORAGE — SANITIZAÇÃO DE PATHS OBRIGATÓRIA
Todo arquivo gerado (DOCX/PDF) salvo no storage DEVE ter o path sanitizado.
NUNCA usar o nome do template ou do cliente diretamente no path.
SEMPRE aplicar a função sanitizePath antes de compor o file name.
Regras de sanitização:
- Remover acentos (normalize('NFD'))
- Substituir espaços e caracteres especiais por underscore (_)
- Converter para lowercase
- Remover underscores duplos e trim
Padrão obrigatório no path: `generated/{tenant_id}/{deal_id}/{timestamp}_{safe_name}.{ext}`

RB-95 DOCUMENTOS — VARIÁVEIS MONETÁRIAS SEM R$
Variáveis monetárias injetadas em templates DOCX DEVEM retornar apenas o número formatado.
O prefixo "R$" já deve estar presente de forma estática no template .docx.
NUNCA enviar "R$ 1.000,00" para o placeholder se o template já tem "R$ [valor]".
Helper: stripCurrencyPrefix(valor) antes do merge.

AP-48 PATH COM ESPAÇOS NO STORAGE
✗ Errado: `generated/123/Contrato de Venda.docx`
✓ Certo: `generated/123/contrato_de_venda.docx`

=============================================================================
BLOCO 30 — NOTIFICATION HUB (v1.0)
=============================================================================

Edge Function: notification-hub
Tabela de regras: notification_rules
Config admin: /admin/notificacoes-config

EVENTOS DISPONÍVEIS:
projeto_status_mudou, credito_aprovado, 
credito_reprovado, credito_aguardando_documentos,
proposta_enviada, proposta_aceita,
documento_solicitado, recibo_emitido,
comissao_aprovada, comissao_paga

CANAIS: email | whatsapp | inapp

RB-96 NOTIFICAÇÕES — USAR NOTIFICATION HUB
Todo evento de negócio que gera notificação 
DEVE passar pelo notification-hub.
NUNCA disparar email/WhatsApp diretamente 
de componente React ou hook.
SEMPRE via: supabase.functions.invoke('notification-hub', { body: { evento, tenant_id, dados } })

AP-49 NOTIFICAÇÃO DIRETA SEM HUB
✗ Errado: chamar wa_outbox diretamente do frontend
✓ Certo: invocar notification-hub com o evento

=============================================================================
BLOCO 31 — PORTAL DO CLIENTE (v1.0)
=============================================================================

Rota pública: /portal/:token
RPC: resolve_portal_token
Token: projetos.portal_token (UUID único por projeto)

RB-97 PORTAL CLIENTE — TOKEN OBRIGATÓRIO
Acesso ao portal SEMPRE via portal_token.
NUNCA expor projeto_id diretamente na URL pública.
NUNCA exigir login do cliente no portal.
Se portal_ativo = false → "Portal desativado".
Se token inválido → "Link inválido".

AP-50 EXPOR PROJETO_ID NA URL PÚBLICA
✗ Errado: /portal/3173eac0-79b2-4791...
✓ Certo: /portal/{portal_token_opaco}

=============================================================================
BLOCO 32 — COMISSÕES (v1.0)
=============================================================================

TABELAS: comissoes, comissoes_transacional, 
commission_plans, pagamentos_comissao

FLUXO OBRIGATÓRIO:
deal 'ganho' → trigger cria comissao (pendente)
gerente aprova → status 'aprovada' → notifica consultor
gerente paga → status 'paga' → notifica consultor

RB-98 COMISSÕES — IDEMPOTÊNCIA
NUNCA criar 2 comissões para o mesmo deal_id.
SEMPRE verificar: SELECT id FROM comissoes 
WHERE deal_id = $deal_id BEFORE INSERT.

RB-99 COMISSÕES — RLS POR ROLE
Consultor: vê só suas comissões (consultor_id = auth.uid())
Gerente/Admin: vê todas do tenant

=============================================================================
BLOCO 33 — TEMPLATES DE DOCUMENTO (v1.0)
=============================================================================

TABELA: document_templates
STORAGE: generated-documents/templates/
SANITIZAÇÃO: sempre usar sanitizeStoragePath() (RB-94)

VARIÁVEIS CANÔNICAS (variablesCatalog.ts):
Cliente: cliente_nome, cliente_cpf_cnpj, cliente_endereco
Empresa: empresa_nome, empresa_cnpj, empresa_responsavel
Consultor: consultor_nome, consultor_telefone
Projeto: projeto_numero, projeto_potencia, projeto_valor_total
Financeiro: saldo_devedor, valor_por_extenso, data_pagamento_br

RB-100 TEMPLATES — VARIÁVEIS VIA CATALOG
NUNCA hardcodar dados no template.
SEMPRE usar variablesCatalog.ts como SSOT.
Variável sem valor → string vazia (nunca undefined).

AP-51 TEMPLATE SEM ARQUIVO BASE
✗ Errado: document_templates com arquivo_base_path NULL
✓ Certo: gerar e salvar arquivo base antes de ativar template

=============================================================================
=============================================================================
BLOCO 34 — GESTÃO DE DOCUMENTOS E ASSINATURAS (v1.0)
=============================================================================
TABELAS:
- generated_documents: status, cancelado_at, cancelado_por,
  motivo_cancelamento, pdf_cancelado_url
- document_signers: status, assinado_por_tipo ('digital'|'fisico'),
  assinado_at, observacao

ESTADOS DO DOCUMENTO:
  rascunho → gerado → aguardando_assinatura
  → assinado_parcial → assinado_completo
  → cancelado | substituido

RB-101 DOCUMENTOS — CANCELAMENTO COM FAIXA
Ao cancelar documento: gerar PDF com faixa diagonal
vermelha via edge function cancel-document.
NUNCA deletar PDF original — manter histórico.
Salvar PDF cancelado em pdf_cancelado_url.

RB-102 DOCUMENTOS — ASSINATURA FÍSICA
Assinatura física registrada em document_signers
com assinado_por_tipo = 'fisico'.
NUNCA considerar documento assinado sem registro
em document_signers para cada signatário.

AP-51 DELETAR DOCUMENTO SEM CANCELAR
✗ Errado: DELETE FROM generated_documents WHERE id = X
✓ Certo: UPDATE SET status = 'cancelado' + gerar PDF faixa

=============================================================================
BLOCO 35 — CONDIÇÕES DE PAGAMENTO (v1.0)
=============================================================================
CAMPOS DINÂMICOS POR FORMA:
- Cheque: banco, agencia, conta, numero, titular, pre_datado
- PIX: chave_pix, comprovante
- Cartão: bandeira, parcelas, nsu
- Boleto: numero, data_vencimento
Salvos em lancamentos_financeiros.metadata (JSONB).

VARIÁVEIS DE TEMPLATE:
  {{pagamento.cheque_banco}}
  {{pagamento.cheque_numero}}
  {{pagamento.cheque_titular}}
  {{pagamento.pix_chave}}
  {{pagamento.cartao_bandeira}}
  {{pagamento.cartao_parcelas}}
  {{pagamento.valor_restante}}
  {{pagamento.forma_entrada}}
  {{pagamento.parcelas_descricao}}
  {{financeiro.saldo_devedor}}

RB-103 PAGAMENTO — CAMPOS OBRIGATÓRIOS POR FORMA
Ao selecionar forma de pagamento em qualquer modal:
SEMPRE exibir campos específicos da forma.
NUNCA aceitar cheque sem número e titular.
NUNCA aceitar cartão sem bandeira e parcelas.
Salvar SEMPRE em metadata JSONB do lançamento.

=============================================================================
BLOCO 36 — FORMATAÇÃO GLOBAL CONCLUÍDA (v1.0)
=============================================================================
COBERTURA COMPLETA (todas as áreas formatadas):
- Modal do cliente ✓
- Lista de leads ✓
- Ficha de crédito ✓
- Lista de recibos ✓
- PDFs gerados ✓
- Contratos gerados ✓

FUNÇÕES CANÔNICAS (src/lib/formatters/index.ts):
  formatCpf(), formatCnpj(), formatCpfCnpj()
  formatPhone(), formatCep()
  formatCurrency(), formatCurrencyInput(), parseCurrency()
  formatDateBR(), parseDateBR(), formatDateTime()
  formatKwp(), formatName()
  displayCpfCnpj(), displayPhone(), displayCurrency()
  displayDate(), sanitizeStoragePath()

RB-104 FORMATAÇÃO — ZERO DADO CRU NA UI
NUNCA exibir CPF/CNPJ sem máscara na interface.
NUNCA exibir data em formato ISO na interface.
NUNCA exibir valor monetário sem R$ na interface.
NUNCA exibir telefone sem máscara na interface.
Usar SEMPRE as funções de src/lib/formatters/index.ts.

AP-52 FORMATAR INLINE NO COMPONENTE
✗ Errado: {cliente.cpf} direto no JSX
✓ Certo: {displayCpfCnpj(cliente.cpf)}

AP-53 DATA ISO NA UI
✗ Errado: {created_at} → "2026-05-17T14:30:00"
✓ Certo: {formatDateBR(created_at)} → "17/05/2026"
=============================================================================
FIM DO AGENTS.md v5.1
=============================================================================
