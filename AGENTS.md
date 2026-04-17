=============================================================================
BLOCO 1 — REGRAS BLOQUEANTES (RB-XX)
NUNCA quebrar. Build falha, PR é rejeitado, código é revertido.
=============================================================================
RB-01 CORES SEMÂNTICAS OBRIGATÓRIAS
NUNCA use: orange-, blue-, green-, red-, #FF6600, #3b82f6, text-orange-500, bg-blue-600
SEMPRE use variáveis CSS:
- Ação principal:  bg-primary, text-primary, border-primary, bg-primary/10
- Superfícies:     bg-card, bg-background, bg-muted
- Textos:          text-foreground, text-muted-foreground, text-card-foreground
- Bordas:          border-border, border-input
- Estados:         bg-success, bg-warning, bg-destructive, bg-info

RB-02 DARK MODE EM TODA TELA NOVA
NUNCA use: bg-white, text-black, text-gray-500, border-gray-200
SEMPRE use: bg-card, text-foreground, text-muted-foreground, border-border
Exceções permitidas (documentar no topo do arquivo):
- Canvas de assinatura (branco por requisito físico)
- Páginas públicas/landing (ver RB-29)
- Tarifas com N casas decimais (ver RB-16)

RB-03 BOTÃO SHADCN OBRIGATÓRIO
NUNCA use: <button> HTML nativo
SEMPRE use: <Button> de @/components/ui/button
Variantes por hierarquia:
- Ação principal:  variant="default"
- Ação secundária: variant="outline"
- Destrutiva:      variant="outline" className="border-destructive text-destructive"
- Cancelar/fechar: variant="ghost"

RB-04 QUERIES SÓ EM HOOKS
NUNCA faça: supabase.from() dentro de componente React
SEMPRE use: hook em src/hooks/ com useQuery
? Ver §16-S1 para template exato

RB-05 STALETIME OBRIGATÓRIO EM TODA QUERY
NUNCA use: useQuery sem staleTime
Padrões:
- Listas, formulários:       staleTime: 1000 * 60 * 5   (5 min)
- Dados em tempo real:       staleTime: 1000 * 30        (30 seg)
- Configurações estáticas:   staleTime: 1000 * 60 * 15  (15 min)

RB-06 SKELETON NO LOADING OBRIGATÓRIO
NUNCA deixe: tela em branco, "Carregando..." texto solto, spinner sem estrutura
SEMPRE use:
- LoadingState  (@/components/shared/LoadingState)   ? páginas inteiras
- SunLoader     (@/components/shared/SunLoader)      ? seções temáticas
- Skeleton      (@/components/ui/skeleton)           ? itens inline/tabelas
NUNCA substitua LoadingState/SunLoader por Skeleton simples (AP-24)

RB-07 MODAL COM w-[90vw] OBRIGATÓRIO
NUNCA use: max-w-* sozinho
SEMPRE use: w-[90vw] max-w-[tamanho]

RB-08 SCROLL INTERNO COM min-h-0 OBRIGATÓRIO
NUNCA use: flex-1 overflow-y-auto sem min-h-0
SEMPRE use: flex-1 min-h-0 overflow-y-auto

RB-09 COMPONENTES EXISTENTES ANTES DE CRIAR NOVO
Lista obrigatória — verificar antes de criar:
- Telefone:   PhoneInput    (@/components/ui-kit/inputs/PhoneInput)
- CPF/CNPJ:   CpfCnpjInput  (@/components/shared/CpfCnpjInput)
- Endereço:   AddressFields (@/components/shared/AddressFields)
- Moeda:      CurrencyInput (@/components/ui-kit/inputs/CurrencyInput)
- Data:       DateInput     (@/components/ui-kit/inputs/DateInput)
- Loading:    LoadingState  (@/components/shared/LoadingState)

RB-10 RESPONSIVIDADE OBRIGATÓRIA
NUNCA use: largura fixa em px (w-[400px], w-[500px])
NUNCA use: max-w-* em páginas admin (exceto modais)
SEMPRE use:
- Grids: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- Flex:  flex-wrap, flex-1, min-w-0
- Teste: 320px (mobile) e 1920px (desktop)

RB-11 HEADER DE PÁGINA ANTES DE ABAS
NUNCA coloque: TabsList antes do título da página
SEMPRE ordem: Header (ícone + título + subtítulo) ? TabsList ? Conteúdo

RB-12 NÃO MODIFICAR src/components/ui/
NUNCA edite: arquivos em src/components/ui/ (exceto switch.tsx e slider.tsx)

RB-13 FUSO HORÁRIO BRASÍLIA OBRIGATÓRIO
NUNCA use: toLocaleString("pt-BR") sem timeZone
SEMPRE use: toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

RB-14 EDGE FUNCTION SEM CHAMADA DIRETA DE FORNECEDOR NO FRONTEND
NUNCA chame: APIs de fornecedor diretamente do frontend
SEMPRE use: Edge Function como intermediário

RB-15 CATALOG SYNC SEM FORNECEDOR_ID COMO DISCRIMINADOR
NUNCA filtre: dados de catálogo usando campo "source" em queries de negócio
SEMPRE use: campo "fornecedor_id" (UUID) como discriminador

RB-16 FORMATADORES POR TIPO DE VALOR
NUNCA use: formatBRL para tarifas com mais de 2 casas decimais
NUNCA use: formatBRL para valores inteiros (ex: economia total sem centavos)
REGRA DE ESCOLHA:
- Valor monetário padrão (R$ 1.234,56):      formatBRL(valor)
- Valor monetário inteiro (R$ 1.234):         formatBRLInteger(valor)
- Valor compacto para espaço pequeno:         formatBRLCompact(valor)
- Tarifa com 4-6 casas (R$ 0.756432/kWh):    NÃO usar formatter — manter como está
- Potência/energia:                           formatKwh(valor)
? Ver §48 para tabela completa de formatadores

RB-17 SEM CONSOLE.LOG EM CÓDIGO DE PRODUÇÃO
NUNCA use: console.log() em src/components/, src/pages/, src/hooks/
NUNCA use: console.log() em supabase/functions/
PERMITIDO:
- console.error() para erros sem outro tratamento visível
- console.warn() para avisos intencionais de comportamento
Para debug temporário: usar // console.log() comentado, nunca ativo

RB-18 TABELA SEMPRE COM overflow-x-auto
NUNCA use: <Table> sem overflow-x-auto no container pai
SEMPRE use: <div className="rounded-lg border border-border overflow-x-auto"><Table>

RB-19 TABLIST SEMPRE COM overflow-x-auto
NUNCA use: <TabsList> sem overflow-x-auto quando tem 3+ abas
SEMPRE use: <TabsList className="overflow-x-auto flex-wrap h-auto">
EXCEÇÃO: TabsList com grid (layout fixo) — não aplicar

RB-20 GRID SEMPRE COM BREAKPOINT MOBILE
NUNCA use: grid-cols-2 fixo em páginas (sem sm: ou md:)
SEMPRE use: grid-cols-1 sm:grid-cols-2 como base mínima
EXCEÇÃO: grids dentro de Dialog/Modal pequenos
EXCEÇÃO: grids compactos de dados (text-xs, font-mono)

RB-21 SHADOW SEMÂNTICO EM CARDS
NUNCA use: shadow-lg em cards de lista ou KPI
SEMPRE use: shadow-sm para cards estáticos
SEMPRE use: hover:shadow-md para cards com hover
EXCEÇÃO: tooltips, dropdowns, modais, elementos flutuantes

RB-22 GATE DE INSTALAÇÃO OBRIGATÓRIO
Todo projeto deve bloquear "Iniciar checklist de instalação" enquanto
não houver proposta com status IN ('aceita','accepted','aprovada','ganha')
OU is_principal = true.
SEMPRE use: useQuery + disabled no botão + banner de aviso bg-warning/10
Implementado em: ProjetoInstalacaoTab.tsx

RB-23 CONSOLE.LOG PROIBIDO EM EDGE FUNCTIONS
Edge Functions em produção não podem ter console.log ativo.
SEMPRE use: console.error apenas para erros reais com prefixo do módulo
Para debug: comentar // console.log() — nunca ativo no deploy
ATENÇÃO: ao comentar console.log multi-linha, comentar TODAS as linhas

RB-24 RECEBIMENTOS USAM MODELO CONTA CORRENTE
Não criar parcelas fixas manualmente.
Usar PagamentoLivreDialog para baixas avulsas.
Status controlado pelo saldo (total_pago vs valor_total).

RB-25 WA AUTOMÁTICO É FIRE-AND-FORGET
Nunca bloquear fluxo de pagamento por falha WA.
Sempre usar .catch(() => {}) na chamada.
Falha no WA = log de erro, não erro para o usuário.

RB-26 EDGE FUNCTIONS DE NOTIFICAÇÃO WA
Sempre usar enqueue_wa_outbox_item via service role.
Nunca chamar API WA diretamente da edge function.
Idempotency key obrigatória para evitar duplicatas.

RB-27 MIGRATIONS FINANCEIRAS
Trigger sync_recebimento_total_pago deve existir
para manter total_pago sincronizado automaticamente.
Nunca calcular total_pago apenas no frontend.

RB-28 SOLARYUM — ENDPOINT MAP
Usar integracaoPlataforma para BuscarKits/MontarKits/BuscarFiltros.
Usar hubB2B apenas para Produtos/Categoria.
IBGE de Cataguases = '3115300'.
Nunca hardcodar IBGE no hook — sempre propagar do WizardState.

RB-29 LANDING PAGE PÚBLICA — TEMA PRÓPRIO
Página /pl/:token é exceção documentada de RB-02.
Paleta própria: #1B3A8C (azul) + #F07B24 (laranja).
3 modelos: ?modelo=1 (padrão), ?modelo=2 (clean), ?modelo=3 (dark)
Documentar no topo: "Página pública — exceção RB-02 aprovada"
Sem AuthGuard. Acesso via token válido (RLS configurado).

RB-30 TEMPLATES DOCX — DESFRAGMENTAÇÃO XML OBRIGATÓRIA
Word fragmenta [ variavel ] em múltiplos <w:r> runs.
SEMPRE usar defragmentXml() ANTES de normalizeVariableFormat().
Normalizar: [ variavel ] e [variavel] ? {{variavel}}
Aplicar em: generate-document, template-preview, docx-to-pdf
Shared: supabase/functions/_shared/normalizeVariableFormat.ts

RB-31 CARD DO PROJETO — STATUS DA PROPOSTA MAIS RELEVANTE
Card deve mostrar status da proposta mais relevante:
1. is_principal = true ? usar essa
2. aceita/ganha ? verde com borda + fundo success/5
3. enviada ? azul com borda info/40
4. Só mostrar recusada se TODAS recusadas ? vermelho
5. Default ? border-border sem destaque
NUNCA usar a proposta mais recente por created_at como padrão.

RB-32 PROPOSTA DESATUALIZADA — APENAS EDIÇÃO MANUAL
"Desatualizada" APENAS quando usuário editou após geração.
Comparar versao.updated_at vs versao.gerado_em (NÃO deal.updated_at).
Grace period mínimo 60s para ignorar updates automáticos do sistema.
NÃO marcar como desatualizada por: geração de PDF, update de status,
processos automáticos, triggers do banco.

RB-33 SEM AUTOSAVE NO WIZARD DE PROPOSTA
Wizard NÃO salva automaticamente no banco de dados.
Autosave em localStorage é PERMITIDO (recuperação de rascunho).
persistAtomic() APENAS por ação explícita do usuário.

RB-34 DOCUMENTOS GERADOS — AÇÕES OBRIGATÓRIAS
Todo documento gerado DEVE ter:
- Botão PDF ? abre/baixa PDF (se pdf_path existe)
- Botão DOCX ? baixa DOCX (se docx_filled_path existe)
- Botão Preview (Eye) ? abre PDF em nova aba via signed URL
- Botão WhatsApp ? envia link ao cliente (fire-and-forget RB-25)
- Botão Deletar (Trash2) ? com confirmação dialog
Badge de contagem deve incluir: storage files + generated_documents

RB-35 VARIÁVEIS LEGADO — MAPEAMENTO OBRIGATÓRIO
Todo alias/legado deve ter substituta mapeada em DEPRECATED_VARS.
Mapeamentos obrigatórios implementados:
capo_m?modulo_garantia, preco_total?valor_total,
vc_nome?cliente_nome, payback_meses?payback,
custo_kit?kits_custo_total, margem_percentual?margem_lucro

RB-36 BOLINHA DE SAÚDE — MAPA DE CORES OBRIGATÓRIO
NUNCA usar cor fixa na bolinha de saúde de variáveis.
SEMPRE usar mapa HEALTH_COLOR com valores do classifier:
IMPLEMENTADA/PASSTHROUGH/CUSTOM* ? bg-success (verde)
FEATURE_NAO_IMPLEMENTADA/CDD    ? bg-muted-foreground/30 (cinza)
FANTASMA_REAL                   ? bg-destructive (vermelho)
ALIAS_LEGADO/PARCIAL_BE_ONLY    ? bg-warning (amarelo)

RB-37 BADGES DE STATUS EM COLUNA
NUNCA colocar badge "Em uso" ao lado do badge de STATUS.
SEMPRE usar flex-col para empilhar badges verticalmente.

RB-38 HISTÓRICO — FILTRAR RUÍDO DO SISTEMA
Eventos value_changed com from_value=0 ou to_value=0
devem ser filtrados da exibição do histórico.
São causados por geração de proposta, não por usuário.

RB-39 PIPELINE COMPLETO DE SUBSTITUIÇÃO EM DOCX
Variáveis em DOCX existem em TODOS os nós XML:
- Parágrafos normais, células de tabela, cabeçalhos, rodapés, Text Boxes
PIPELINE OBRIGATÓRIO (nesta ordem exata):
1. defragmentXml()
2. cleanupRemainingFragments()
3. normalizeVariableFormat()
4. Limpar XML tags residuais dentro de {{ e }}
5. replaceVars() com escapeXml()
6. evaluateInlineFormulas()
7. Limpar placeholders residuais
RUNTIME: Edge Functions usam Deno + fflate (não docxtemplater/PizZip)

RB-40 ACEITE DE PROPOSTA — EFEITOS COLATERAIS OBRIGATÓRIOS
Ao aceitar uma proposta (proposal-transition ? accept):
1. Setar is_principal = true na proposta aceita
2. Setar status = 'recusada' + is_principal = false nas irmãs
3. Cancelar generated_documents com status = 'generated' do mesmo projeto
   ? setar status = 'cancelled', observacao = 'Nova proposta aceita'
4. NUNCA cancelar documento com signature_status = 'signed' — é INTOCÁVEL

RB-41 CANCELAMENTO DE CONTRATO — MOTIVO OBRIGATÓRIO
Ao cancelar um documento gerado manualmente:
- Abrir modal pedindo motivo/observação
- Salvar em generated_documents.observacao
NUNCA cancelar sem motivo — UX e auditoria exigem rastreabilidade.

RB-42 VARIÁVEIS MONETÁRIAS — SEM PREFIXO R$
Variáveis retornam APENAS o número formatado (ex: "7.718,40").
O template DOCX já tem "R$" escrito antes da variável.
Implementado em: _shared/resolvers/resolveFinanceiro.ts

RB-43 GENERATE-DOCUMENT — QUERY COM OR OBRIGATÓRIO
SEMPRE usar .or(deal_id.eq.${deal_id},projeto_id.eq.${deal_id})
NUNCA simplificar para .eq("projeto_id", deal_id) apenas.

RB-44 CONTRATO ASSINADO É INTOCÁVEL
Documento com signature_status = 'signed' NUNCA pode ser cancelado
automaticamente. Toda query de cancelamento DEVE incluir:
.neq("signature_status", "signed")

RB-45 EDIÇÃO DE PROPOSTA ACEITA REQUER CONFIRMAÇÃO
Ao editar proposta com status 'aceita':
1. Exibir Dialog de confirmação com aviso
2. Campo motivo/observação obrigatório (Textarea)
3. Cancelar generated_documents (status='generated', signature_status != 'signed')
4. Salvar motivo em generated_documents.observacao
5. Só então redirecionar ao wizard
Implementado em: PropostaExpandedDetail.tsx (handleEditWithProtection)

RB-46 CANCELAR PROPOSTA ACEITA CANCELA CONTRATOS
Quando proposal-transition processa aceita ? cancelada:
- Cancelar generated_documents (status='generated', signature_status != 'signed')
- observacao = 'Proposta cancelada'

RB-47 ACEITE/RECUSA PÚBLICO VIA EDGE FUNCTION
Páginas públicas NUNCA fazem UPDATE direto em propostas_nativas.
SEMPRE usar edge function proposal-public-action.

RB-48 EXPIRAÇÃO AUTOMÁTICA DE PROPOSTAS
Cron job diário às 08:00 UTC (job 64) via proposal-auto-expire.
NUNCA expirar propostas 'aceita' ou 'rascunho'.

RB-49 CONTRATO ASSINADO BLOQUEIA EDIÇÃO
Se existir generated_documents com signature_status = 'signed'
vinculado ao projeto da proposta, bloquear edição completamente.
Toast: "Esta proposta possui contrato assinado digitalmente e não pode ser editada."

RB-50 FLUXO RÁPIDO LEAD ? PROPOSTA
NUNCA criar cliente/projeto duplicado — sempre buscar antes de criar.
Implementado em: src/hooks/usePropostaRapidaLead.ts

RB-51 PDF DE PROPOSTA — SEM RE-GERAÇÃO AUTOMÁTICA
NUNCA re-gerar PDF automaticamente ao abrir aba "Arquivo".
Se proposta tem pdf_path salvo ? exibir diretamente do storage.

RB-53 REALTIME — TABELAS CRÍTICAS OBRIGATÓRIAS
As seguintes tabelas DEVEM estar na publicação supabase_realtime:
deals, clientes, leads, propostas_nativas, proposta_versoes,
projetos, generated_documents, pipeline_stages
Verificar: SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
NUNCA lançar feature com Realtime sem verificar a publicação.

RB-54 TEMPLATE WEB — template_id_used OBRIGATÓRIO (CORRIGIDO v3.13)
Ao gerar proposta com template HTML, SEMPRE gravar template_id_used
em proposta_versoes após persistAtomic() bem-sucedido.
NUNCA deixar template_id_used NULL em versões com template HTML.
Se template_id_used é NULL em template HTML em produção ? considerar
bug de gravação: logar console.error e exibir toast de aviso ao usuário.

RB-55 REFERÊNCIA CIRCULAR — VERIFICAR ANTES DE DEPLOY
Erro "Cannot access X before initialization" = referência circular no bundle.
SEMPRE verificar antes de deploy: npx madge --circular src/
useCallback/useEffect que usa função local: declarar a função ANTES do hook.

RB-56 PIPELINE_STAGES — NOME CORRETO DA TABELA
A tabela de etapas se chama pipeline_stages (NÃO deal_pipeline_stages).
A tabela de pipelines se chama pipelines (NÃO deal_pipelines).
A coluna de fechamento se chama is_closed (NÃO is_lost).
SEMPRE verificar nomes reais antes de usar em edge functions.

RB-57 EDGE FUNCTION — PROIBIDO LET MUTÁVEL NO ESCOPO DE MÓDULO
Contexto: Deno Deploy reutiliza o mesmo isolate entre requests.
Variáveis let no topo do módulo são compartilhadas entre tenants diferentes,
causando contaminação de dados silenciosa e intermitente.
NUNCA use let no escopo de módulo — usar const ou createInitialState() por request.

RB-58 UPDATE CRÍTICO — VERIFICAR LINHAS AFETADAS
Contexto: Supabase retorna sucesso (sem erro) em UPDATE com 0 linhas afetadas
quando não há violação de constraint. Bugs silenciosos.
SEMPRE use uma das opções:
  // Opção A — verificar count:
  const { error, count } = await supabase
    .from("projetos").update({ etapa_id }).eq("id", projeto_id);
  if (!error && count === 0) {
    console.error("[hook] UPDATE afetou 0 linhas — id não encontrado:", projeto_id);
    throw new Error("Projeto não encontrado");
  }
  // Opção B — usar .select() para confirmar:
  const { data, error } = await supabase
    .from("projetos").update({ etapa_id }).eq("id", projeto_id).select("id");
  if (!error && (!data || data.length === 0)) {
    throw new Error("Projeto não encontrado");
  }
Ações críticas que EXIGEM verificação:
- moveProjetoToConsultor, moveProjetoToEtapa (Kanban)
- updatePropostaStatus
- qualquer UPDATE que muda owner, pipeline, stage ou status

=============================================================================
BLOCO 2 — BOAS PRÁTICAS
=============================================================================
BP-01 FRAMER MOTION EM ENTRADAS — Animate cards com stagger para UX premium
BP-02 TOOLTIP EM TEXTO TRUNCADO MOBILE
BP-03 FORMATADORES CENTRALIZADOS — usar formatBRL, formatKwh, formatDateBR de src/lib/formatters
BP-04 LÓGICA EM SERVICES, NÃO COMPONENTES
BP-05 PRINCÍPIOS DE ENGENHARIA — SRP, DRY, SSOT, KISS, YAGNI
BP-06 SAFE QUERY PATTERNS — Respeite tenant isolation, evite selects desnecessários

=============================================================================
BLOCO 3 — SNIPPETS OBRIGATÓRIOS
=============================================================================
§48-S1 — FORMATADORES (Referência Completa)
Dado                           | Formatter               | Exemplo de saída
-------------------------------|-------------------------|------------------
Moeda padrão                   | formatBRL(v)            | R$ 1.234,56
Moeda sem decimais             | formatBRLInteger(v)     | R$ 1.234
Moeda compacta (espaço pequeno)| formatBRLCompact(v)     | R$ 1,2k
Potência/energia               | formatKwh(v)            | 6,1 kWp
Percentual                     | formatPercent(v)        | 12,5%
Data                           | formatDateBR(v)         | 15/03/2026
Telefone                       | formatPhoneBR(v)        | (11) 98765-4321
Tarifa c/ 4-6 casas decimais   | NÃO usar formatter      | R$ 0.756432/kWh
Rótulo de eixo Y em gráfico    | NÃO usar formatter      | R$ 1,2k (inline)

§49-S1 — LOGGING (Regras de produção)
PERMITIDO:
console.error("[NomeDoModulo] Erro ao buscar dados:", error);
console.warn("[NomeDoModulo] Dado ausente, usando fallback");
PROIBIDO em produção:
console.log("dados:", data);
console.log("clicou:", item);

=============================================================================
BLOCO 4 — ANTI-PADRÕES (AP-XX)
=============================================================================
AP-01 QUERY DIRETA EM COMPONENTE
AP-02 COR HARDCODED / NÃO-SEMÂNTICA
AP-03 MODAL SEM w-[90vw]
AP-04 SCROLL SEM min-h-0
AP-05 INPUT HTML NATIVO (usar CurrencyInput, PhoneInput, etc.)
AP-06 TABELA SEM overflow-x-auto
AP-07 MARGIN EM COMPONENTE FILHO (usar gap no pai)
AP-08 BOTÃO HTML NATIVO (usar <Button>)
AP-09 useQuery SEM staleTime
AP-21 CORES HARDCODED EM GRÁFICOS
  ? Errado: stroke="#3b82f6", fill="#10b981"
  ? Certo:  stroke="hsl(var(--primary))", fill="hsl(var(--success))"
AP-22 FORMATTER ERRADO PARA TIPO DE DADO
  ? Errado: formatBRL(tarifa) onde tarifa = 0.756432 (perde precisão)
  ? Certo:  escolher formatter pelo tipo — ver §48-S1
AP-23 CONSOLE.LOG EM PRODUÇÃO
  ? Errado: console.log("dados:", data)
  ? Certo:  remover ou comentar
AP-24 LOADING STATE BRANDED SUBSTITUÍDO POR SKELETON SIMPLES
  ? Errado: substituir <LoadingState /> por <Skeleton />
  ? Certo:  LoadingState = páginas, SunLoader = seções, Skeleton = inline
AP-25 BADGE EM USO SOBREPONDO STATUS
  ? flex gap-1 (sobreposição em colunas estreitas)
  ? flex flex-col gap-1 items-start
AP-26 BOLINHA DE SAÚDE SEM MAPA
  ? Cor fixa ou hardcoded
  ? HEALTH_COLOR[v.governance] ?? HEALTH_COLOR[v.healthClassification]
AP-27 CARD COM PROPOSTA MAIS RECENTE
  ? propostas.sort(created_at)[0]
  ? Priorizar is_principal, depois por relevância de status
AP-28 CONTAGEM DE DOCUMENTOS INCOMPLETA
  ? Contar apenas storage bucket
  ? storage files + generated_documents table
AP-29 CONTRATO SEM DESFRAGMENTAÇÃO
  ? normalizeVariableFormat() direto no XML do Word
  ? defragmentXml() ANTES de normalizeVariableFormat()

=============================================================================
BLOCO 5 — DECISÕES ARQUITETURAIS (DA-XX)
=============================================================================
DA-12 FORMATADORES POR TIPO, NÃO POR APARÊNCIA
DA-13 LOADING STATES BRANDED SÃO DESIGN SYSTEM
DA-14 MIGRAÇÃO PROGRESSIVA DE DÉBITO TÉCNICO
DA-15 ARQUITETURA DE VARIÁVEIS DE PROPOSTA — DOIS RESOLVERS
DA-16 MOTOR DE GOVERNANÇA DE VARIÁVEIS
DA-17 ALIASES OBRIGATÓRIOS NO RESOLVER BE
DA-18 ASSINATURA ELETRÔNICA — ZAPSIGN
DA-19 LANDING PAGE — DADOS DO SNAPSHOT
DA-20 RLS LANDING PAGE PÚBLICA
DA-21 DOCX PROCESSING — FFLATE NATIVO, NÃO DOCXTEMPLATER
DA-22 JOBS DE PURGE — RETENÇÃO AUTOMÁTICA
DA-23 HOOKS DEDICADOS PARA QUERIES
DA-24 VARIÁVEL [cidade] — FALLBACK CHAIN
DA-25 EMPRESA_* LÊ DE TENANTS COM FALLBACK BRAND_SETTINGS
DA-26 CEP COM MÁSCARA OBRIGATÓRIA
DA-27 ADAPTER PATTERN PARA ASSINATURA DIGITAL
DA-28 CLICKSIGN USA 3 CHAMADAS API
DA-29 WEBHOOK DETECTA PROVIDER PELO PAYLOAD
DA-30 APP_URL UNIFICADO — FALLBACK CORRETO
Domínio canônico: https://maisenergiasolar.lovable.app
Rota canônica de proposta pública: /proposta/:token (NUNCA /pl/:token)
DA-31 WEBHOOK DE ASSINATURA — URL EXIBIDA EM SIGNATURETAB
DA-32 HOOK usePropostaRapidaLead — INTERFACE QuickLeadData
DA-33 AUTENTIQUE — ADAPTER GRAPHQL
DA-34 SIGNATÁRIOS AUTOMÁTICOS NO ENVIO PARA ASSINATURA
DA-35 BANCO DE DADOS — JOBS DE PURGE ATIVOS
DA-37 CÁLCULO FINANCEIRO — MOTOR CANÔNICO
calcGrupoB.ts é o motor canônico para Grupo B.
calcGrupoA.ts é o motor canônico para Grupo A.
calcFinancialSeries.ts DEVE chamar calcGrupoB/calcGrupoA — nunca lógica própria.
DA-38 TEMPLATE WEB — FLUXO CORRETO (CORRIGIDO v3.13)
Templates WEB (tipo html) armazenados como JSON de TemplateBlock[] em template_html.
Rota pública: /proposta/:token verifica template_id_used na versão.
Se template_id_used existe ? redireciona para /pl/:token.
Se template_id_used é NULL em geração nova (pós v3.12) ? é bug: logar e exibir aviso.
NUNCA usar template_id_used com templates DOCX — apenas HTML.
DA-39 REALTIME — PADRÃO OBRIGATÓRIO
Todo canal Realtime DEVE seguir:
const channel = supabase.channel('nome-unico')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tabela' },
    () => queryClient.invalidateQueries({ queryKey: ['chave'] }))
  .subscribe()
return () => supabase.removeChannel(channel)
Verificar pg_publication_tables antes de implementar (RB-53).
DA-41 SECURITY DEFINER VIEWS — GOVERNANÇA OBRIGATÓRIA
Toda view com SECURITY DEFINER deve:
1. Filtrar por tenant_id explicitamente (WHERE tenant_id = get_user_tenant_id())
2. Ser auditada semestralmente
3. Ter comentário no topo: -- SECURITY DEFINER: filtro tenant_id obrigatório
NUNCA criar nova view SECURITY DEFINER sem filtro de tenant.

=============================================================================
BLOCO 6 — REFERÊNCIA RÁPIDA DE PADRÕES
=============================================================================
§48. FORMATADORES — Tabela completa ? ver §48-S1
§49. LOGGING — Regras de produção ? ver §49-S1

=============================================================================
BLOCO 7 — VALIDAÇÃO AUTOMÁTICA (SCRIPT PRE-BUILD)
=============================================================================
Checks ativos em scripts/validate-agents.js:
- AP-23: console.log em produção
- AP-21: cores hardcoded em gráficos
- RB-55: referências circulares via madge (npx madge --circular src/)
- RB-16: formatBRL aplicado a tarifa (heurística)
- RB-57: let mutável em escopo de módulo em Edge Functions

=============================================================================
BLOCO 8 — CONVENÇÕES DE NOMENCLATURA
=============================================================================
[Mantido integralmente da v2.5]

=============================================================================
BLOCO 9 — CHECKLIST FINAL ANTES DE COMMITAR (CONSOLIDADO v3.13)
=============================================================================
Checklist base (todo commit)
[ ] Build passa: npm run build (zero erros)
[ ] Lint passa: npm run lint
[ ] Validação AGENTS: npm run prebuild
[ ] Referências circulares: npx madge --circular src/ (RB-55)
[ ] Cores: Nenhum orange-, blue-, #hex em componentes novos
[ ] Dark mode: Testei em modo escuro
[ ] Responsive: Testei em 320px e 1920px
[ ] Queries: Estão em hooks com staleTime
[ ] Botões: Todos são <Button> do shadcn
[ ] Modais: Têm w-[90vw] e min-h-0
[ ] Formatadores: Escolhi o formatter correto pelo TIPO do dado (§48)
[ ] Console.log: Nenhum ativo em src/ (apenas comentados)
[ ] Loading states: Usei LoadingState/SunLoader para páginas, Skeleton para inline
[ ] Tabelas: overflow-x-auto no container pai (RB-18)
[ ] TabsList: overflow-x-auto flex-wrap h-auto quando 3+ abas (RB-19)
[ ] Grids: grid-cols-1 como base mínima (RB-20)
[ ] Shadows: shadow-sm em cards, shadow-lg apenas em flutuantes (RB-21)
[ ] Changelog: Atualizado se mudança funcional

Se alterou Edge Function
[ ] Nenhum let no escopo de módulo (RB-57)
[ ] console.log removidos ou comentados (RB-23)
[ ] tenant_id validado em todas as queries
[ ] UPDATEs críticos verificam count ou usam .select() (RB-58)
[ ] Se alterou _shared/*.ts ? redeploy: template-preview, generate-proposal, docx-to-pdf

Se criou/alterou UPDATE de estado
[ ] Verificação de count > 0 ou .select() após update crítico (RB-58)
[ ] Toast de erro se 0 linhas afetadas

Se usou Realtime
[ ] Verificar pg_publication_tables antes (RB-53)
[ ] Cleanup com supabase.removeChannel no return do useEffect (DA-39)

Se gerou proposta com template HTML
[ ] template_id_used gravado após persistAtomic (RB-54)

Se adicionou variável aos resolvers
[ ] knownKeys.ts atualizado (DA-16)
[ ] Alias/legado mapeado em DEPRECATED_VARS (RB-35)

Se trabalhou com DOCX
[ ] Pipeline completo: defragment ? cleanup ? normalize ? replace ? formulas ? cleanup residual (RB-39)
[ ] Variáveis monetárias sem prefixo R$ no resolver (RB-42)

Se adicionou Security Definer View
[ ] Filtro por tenant_id obrigatório (DA-41)
[ ] Comentário no topo da view documentando o SECURITY DEFINER (DA-41)

=============================================================================
BLOCO 10 — REGRESSÕES CONHECIDAS — NUNCA QUEBRAR
=============================================================================
WhatsApp / process-webhook-events
extractMessageContent trata ephemeralMessage, audioMessage, documentMessage — NÃO alterar
Nunca remover fallback msg.message || {}

AuthForm / handleSignIn — NÃO MODIFICAR
DEVE ter: const handleSignIn = async (data: LoginData) => {

Edge Functions — deploy obrigatório
Após alteração em supabase/functions/_shared/*.ts:
redeploy: template-preview, generate-proposal, docx-to-pdf

Snapshot camelCase — fallback duplo obrigatório
pagamentoOpcoes ?? pagamento_opcoes (e demais campos)
Nunca remover fallbacks de camelCase

Resolvers de proposta — implementação paralela (AP-15)
FRONTEND: src/lib/resolveProposalVariables.ts
BACKEND:  supabase/functions/_shared/resolvers/
Sempre sincronizar os dois

Campos de kit — nomes corretos (AP-16)
SEMPRE: modulo?.potencia_w, inversor?.potencia_w
NUNCA:  modulo?.potencia (campo não existe)

usePaybackEngine — queries useQuery (não reverter para useState)
Itens inativos — opacity-50 obrigatório
Catálogo multi-fornecedor
NUNCA .eq("source", "edeltec") — usar .eq("fornecedor_id", id)
NUNCA kit.source === "edeltec" — usar !!kit.fornecedor_id

Drag-and-drop Kanban — CORRIGIDO v3.13
useProjetoPipeline.ts: moveProjetoToConsultor e moveProjetoToEtapa
DEVEM usar projetos.id (não deal_id) no UPDATE
SEMPRE verificar count > 0 após o update (RB-58)
NUNCA passar deal_id onde projetos.id é esperado — são campos distintos

=============================================================================
BLOCO 11 — REGRAS DE ESCOPO
=============================================================================
Quando a tarefa diz "only touch X", NÃO tocar em outros arquivos
Se encontrar outro bug, REPORTAR mas não corrigir — abrir tarefa separada
Nunca "aproveitar" para refatorar código adjacente
Migração de débito técnico (C-01/C-02): máximo 1 módulo por PR
Security Definer Views: auditar em sessão dedicada, não como sub-tarefa

=============================================================================
BLOCO 12 — DESIGN SYSTEM VISUAL
=============================================================================
§DS-01 TIPOGRAFIA — Hierarquia única
Elemento                       | Classes obrigatórias
-------------------------------|---------------------------------------------
Título de página (h1)          | text-xl font-bold text-foreground
Subtítulo de página            | text-sm text-muted-foreground
Título de card/seção (h2)      | text-base font-semibold text-foreground
Label de campo                 | text-sm font-medium text-foreground
Texto de corpo                 | text-sm text-foreground
Texto auxiliar/hint            | text-xs text-muted-foreground
Valor numérico destaque        | text-2xl font-bold tracking-tight text-foreground
Valor monetário em tabela      | text-sm font-mono text-foreground

§DS-02 CARDS — Padrão único
// Card padrão:
<Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
  <CardContent className="p-5">{/* conteúdo */}</CardContent>
</Card>
// Card KPI:
<Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
  <CardContent className="flex items-center gap-4 p-5">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">Valor</p>
      <p className="text-sm text-muted-foreground mt-1">Label</p>
    </div>
  </CardContent>
</Card>
// Variações de cor do card KPI:
// border-l-primary    + bg-primary/10    (padrão)
// border-l-destructive + bg-destructive/10 (alerta)
// border-l-success    + bg-success/10    (positivo)
// border-l-warning    + bg-warning/10    (atenção)

§DS-05 BADGES E STATUS
// Ativo/Concluído/Aprovado:  bg-success/10 text-success border-success/20
// Pendente/Em progresso:     bg-warning/10 text-warning border-warning/20
// Inativo/Cancelado/Erro:    bg-destructive/10 text-destructive border-destructive/20
// Informativo/Neutro:        bg-muted text-muted-foreground border-border
// Destaque/Principal:        bg-primary/10 text-primary border-primary/20

=============================================================================
BLOCO 13 — SPRINTS CONCLUÍDOS
=============================================================================
Módulo Financeiro (F1-F4), Gateways (G1-G5), Conta Corrente (R1-R4) ?
Integração Solaryum JNG/Vertys (S1-S3) ?
Migração C-01 (~170 queries ? hooks) ?
Sprints Visuais V1-V5 ?
Gate de instalação — IMPLEMENTADO v3.2 ?
Backlog ativo:
C-02: SolarMarketPage.tsx ? extrair tabs (§50-S1)
Banco: Security Definer Views ? auditoria dedicada (DA-41)

=============================================================================
BLOCO 14 — CONTEXTO DO PROJETO
=============================================================================
Stack: React + Vite + TypeScript + Supabase + Tailwind CSS + shadcn/ui + React Query
Agente de geração: Lovable
Tenant real: 17de8315-2e2f-4a79-8751-e5d507d69a41

Pipelines Comercial e Engenharia:
- Sistema de funis: tabelas projeto_funis + projeto_etapas
- Hook principal: useProjetoPipeline.ts
- Projetos ligados por: projetos.funil_id + projetos.etapa_id
- Consultores: Bruno Bandeira, Claudia, Diego, Ian Souza, Renan, Sebastião, Não Definido

Configurações: 4 bancos, 35 concessionárias, 8 motivos de perda

Nomes corretos de tabelas (armadilhas comuns — RB-56):
pipeline_stages       (NÃO deal_pipeline_stages)
pipelines             (NÃO deal_pipelines)
is_closed             (NÃO is_lost)
propostas_nativas     (NÃO propostas)
proposta_versoes      (NÃO versoes_proposta)
projeto_funis         (funis do kanban de projetos)
projeto_etapas        (etapas do kanban de projetos)

Arquivos protegidos (NUNCA modificar):
src/pages/Auth.tsx
src/pages/PendingApproval.tsx
src/components/ui/AuthForm.tsx (bypass admin/super_admin)
src/pages/PropostaPublica.tsx

Domínio canônico: https://maisenergiasolar.lovable.app
Rota pública de proposta: /proposta/:token

=============================================================================
FIM DO AGENTS.md v3.14
=============================================================================