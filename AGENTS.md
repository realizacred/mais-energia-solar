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
FIM DO AGENTS.md v4.0
=============================================================================
