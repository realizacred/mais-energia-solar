# AGENTS.md v3.2 — Mais Energia Solar CRM
# Padrões obrigatórios para geração de código via AI (Lovable, Copilot, etc.)
# Última atualização: 2026-04-01 (v3.2 — Migração C-01 concluída + Gate de instalação)
# Changelog v3.2: Migração C-01 concluída (40+ hooks, ~170 queries migradas)
#                 RB-22 (gate instalação), RB-23 (console.log EF) adicionados
#                 DA-15 (arquitetura dois resolvers) adicionado
#                 Tabela completa de hooks criados adicionada
# Changelog v3.1: Sprints Visuais V1-V5 concluídos — ver Bloco 10
# Changelog v3.0: RB-16, RB-17, AP-21, AP-22, AP-23, AP-24 adicionados
#                 DA-12, DA-13, DA-14 adicionados
#                 §48, §49, §50 adicionados
#                 Bloco 10 atualizado com status de correções
#                 Bloco 12 novo — Design System Visual

# =============================================================================
# ⚠️ INSTRUÇÃO PRIMÁRIA PARA AI — LEIA PRIMEIRO
# =============================================================================

# SEMPRE siga estas regras na ordem de prioridade:
# 1. REGRAS BLOQUEANTES (Bloco 1) — NUNCA quebrar, build falha se descumprir
# 2. SNIPPETS OBRIGATÓRIOS (Bloco 3) — Copie e cole EXATAMENTE, não improvise
# 3. ANTI-PADRÕES (Bloco 4) — NUNCA faça isso, já foi proibido
# 4. DECISÕES (Bloco 5) — Entenda o "por que" antes de criar algo novo
# 5. BOAS PRÁTICAS (Bloco 2) — Siga quando não conflitar com 1-4

# =============================================================================
# BLOCO 0 — ÍNDICE RÁPIDO POR TIPO DE TAREFA
# =============================================================================

Estou criando...             | Regras principais              | Snippet          | Anti-padrões
-----------------------------|-------------------------------|------------------|---------------------------
Novo componente React        | §1 → §22 → §32                | §25-S1           | AP-02, AP-05, AP-07
Nova query Supabase          | §16 → §23 → §18               | §16-S1           | AP-01, AP-09
Novo modal/drawer            | §25 → §36 → §39               | §25-S1           | AP-03, AP-04
Novo input formulário        | §13 → §2 → §33                | §13 (lista)      | AP-05, AP-08
Nova feature WhatsApp        | §39 → §41 → §43               | §39-S1           | AP-04
Nova Edge Function           | §EF → §EF-S1 → §45            | §EF-S1           | AP-17..AP-20
Novo fornecedor              | §CATALOG-S1 → §EF → DA-09     | §CATALOG-S1      | AP-17..AP-20
Correção sync/catálogo       | §CATALOG-S2 → Bloco 10        | —                | AP-17, AP-20
Novo hook customizado        | §16 → §23 → §20               | §16-S1           | AP-01, AP-09
Correção de bug visual       | §1 → Bloco 12                 | —                | AP-02, AP-03, AP-04
Nova tela admin              | §6 → §26 → §29 → Bloco 12    | §25-S1           | AP-06
Nova tabela/lista            | §4 → §12 → §34                | §4-S1            | AP-06
Novo gráfico                 | §5 → §27                      | §5-S1            | AP-21 (novo)
Formatação de valor          | §19 → §48 (novo)              | —                | AP-14, AP-22 (novo)
Debug/logging                | §49 (novo)                    | —                | AP-23 (novo)

# =============================================================================
# BLOCO 1 — REGRAS BLOQUEANTES (RB-XX)
# NUNCA quebrar. Build falha, PR é rejeitado, código é revertido.
# =============================================================================

RB-01 CORES SEMÂNTICAS OBRIGATÓRIAS
    NUNCA use: orange-*, blue-*, green-*, red-*, #FF6600, #3b82f6, text-orange-500, bg-blue-600
    SEMPRE use variáveis CSS:
      - Ação principal:  bg-primary, text-primary, border-primary, bg-primary/10
      - Superfícies:     bg-card, bg-background, bg-muted
      - Textos:          text-foreground, text-muted-foreground, text-card-foreground
      - Bordas:          border-border, border-input
      - Estados:         bg-success, bg-warning, bg-destructive, bg-info

RB-02 DARK MODE EM TODA TELA NOVA
    NUNCA use: bg-white, text-black, text-gray-500, border-gray-200
    SEMPRE use: bg-card, text-foreground, text-muted-foreground, border-border
    Exceções permitidas:
      - Canvas de assinatura (branco por requisito físico)
      - Páginas públicas/landing (documentar o motivo)
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
    → Ver §16-S1 para template exato

RB-05 STALETIME OBRIGATÓRIO EM TODA QUERY
    NUNCA use: useQuery sem staleTime
    Padrões:
      - Listas, formulários:   staleTime: 1000 * 60 * 5  (5 min)
      - Dados em tempo real:   staleTime: 1000 * 30       (30 seg)
      - Configurações estáticas: staleTime: 1000 * 60 * 15 (15 min)

RB-06 SKELETON NO LOADING OBRIGATÓRIO
    NUNCA deixe: tela em branco, "Carregando..." texto solto, spinner sem estrutura
    SEMPRE use: Skeleton de @/components/ui/skeleton OU componente branded do projeto:
      - LoadingState  (@/components/shared/LoadingState)   ← para páginas inteiras
      - SunLoader     (@/components/shared/SunLoader)      ← para seções temáticas
      - Skeleton      (@/components/ui/skeleton)           ← para itens inline/tabelas
    NUNCA substitua LoadingState/SunLoader por Skeleton simples — são branded e superiores

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
    SEMPRE ordem: Header (ícone + título + subtítulo) → TabsList → Conteúdo

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

RB-16 FORMATADORES POR TIPO DE VALOR (NOVO v3.0)
    NUNCA use: formatBRL para tarifas com mais de 2 casas decimais
    NUNCA use: formatBRL para valores inteiros (ex: economia total sem centavos)
    REGRA DE ESCOLHA:
      - Valor monetário padrão (R$ 1.234,56):     formatBRL(valor)
      - Valor monetário inteiro (R$ 1.234):        formatBRLInteger(valor)
      - Valor compacto para espaço pequeno:        formatBRLCompact(valor)
      - Tarifa com 4-6 casas (R$ 0.756432/kWh):   NÃO usar formatter — manter como está
      - Potência/energia:                          formatKwh(valor)
    → Ver §48 para tabela completa de formatadores

RB-17 SEM CONSOLE.LOG EM CÓDIGO DE PRODUÇÃO (NOVO v3.0)
    NUNCA use: console.log() em src/components/, src/pages/, src/hooks/
    NUNCA use: console.log() em supabase/functions/
    PERMITIDO:
      - console.error() para erros sem outro tratamento visível
      - console.warn() para avisos intencionais de comportamento
    Para debug temporário: use // console.log() comentado, nunca ativo
    🔍 Detectar: grep -rn "console\.log" src/ supabase/functions/ --include="*.ts" --include="*.tsx" | grep -v "//"

RB-18 TABELA SEMPRE COM overflow-x-auto (NOVO v3.1)
    NUNCA use: <Table> sem overflow-x-auto no container pai
    SEMPRE use: <div className="rounded-lg border border-border overflow-x-auto"><Table>

RB-19 TABLIST SEMPRE COM overflow-x-auto (NOVO v3.1)
    NUNCA use: <TabsList> sem overflow-x-auto quando tem 3+ abas
    SEMPRE use: <TabsList className="overflow-x-auto flex-wrap h-auto">
    EXCEÇÃO: TabsList com grid (layout fixo) — não aplicar

RB-20 GRID SEMPRE COM BREAKPOINT MOBILE (NOVO v3.1)
    NUNCA use: grid-cols-2 fixo em páginas (sem sm: ou md:)
    SEMPRE use: grid-cols-1 sm:grid-cols-2 como base mínima
    EXCEÇÃO: grids dentro de Dialog/Modal pequenos
    EXCEÇÃO: grids compactos de dados (text-xs, font-mono)

RB-21 SHADOW SEMÂNTICO EM CARDS (NOVO v3.1)
    NUNCA use: shadow-lg em cards de lista ou KPI
    SEMPRE use: shadow-sm para cards estáticos
    SEMPRE use: hover:shadow-md para cards com hover
    EXCEÇÃO: tooltips, dropdowns, modais, elementos flutuantes

RB-22 GATE DE INSTALAÇÃO OBRIGATÓRIO (NOVO v3.2)
    Todo projeto deve bloquear "Iniciar checklist de instalação" enquanto
    não houver proposta com status IN ('aceita','accepted','aprovada','ganha')
    OU is_principal = true.
    SEMPRE use: useQuery + disabled no botão + banner de aviso bg-warning/10
    Implementado em: ProjetoInstalacaoTab.tsx

RB-23 CONSOLE.LOG PROIBIDO EM EDGE FUNCTIONS (NOVO v3.2)
    Edge Functions em produção não podem ter console.log ativo.
    SEMPRE use: console.error apenas para erros reais com prefixo do módulo
    Para debug: comentar // console.log() — nunca ativo no deploy
    ATENÇÃO: ao comentar console.log multi-linha, comentar TODAS as linhas
    (incluindo o corpo do objeto), não apenas a primeira linha

# =============================================================================
# BLOCO 2 — BOAS PRÁTICAS
# =============================================================================

BP-01 FRAMER MOTION EM ENTRADAS — Animate cards com stagger para UX premium
BP-02 TOOLTIP EM TEXTO TRUNCADO MOBILE
BP-03 FORMATADORES CENTRALIZADOS — usar formatBRL, formatKwh, formatDateBR de src/lib/formatters
BP-04 LÓGICA EM SERVICES, NÃO COMPONENTES
BP-05 PRINCÍPIOS DE ENGENHARIA — SRP, DRY, SSOT, KISS, YAGNI
BP-06 SAFE QUERY PATTERNS — Respeite tenant isolation, evite selects desnecessários

# =============================================================================
# BLOCO 3 — SNIPPETS OBRIGATÓRIOS
# =============================================================================

# [Mantidos integralmente da v2.5 — §16-S1, §25-S1, §36-S1, §39-S1, §EF-S1, §CATALOG-S1, §CATALOG-S2, §4-S1, §12-S1, §26-S1, §27-S1, §5-S1]
# Novos snippets adicionados abaixo:

# ------------------------------------------------------------------------------
# §48-S1 — FORMATADORES (Referência Completa v3.0)
# ------------------------------------------------------------------------------

# TABELA DE FORMATADORES — escolha pelo tipo de dado, não pelo visual desejado:
#
# Dado                          | Formatter              | Exemplo de saída
# ------------------------------|------------------------|------------------
# Moeda padrão                  | formatBRL(v)           | R$ 1.234,56
# Moeda sem decimais            | formatBRLInteger(v)    | R$ 1.234
# Moeda compacta (espaço pequeno)| formatBRLCompact(v)   | R$ 1,2k
# Potência/energia              | formatKwh(v)           | 6,1 kWp
# Percentual                    | formatPercent(v)       | 12,5%
# Data                          | formatDateBR(v)        | 15/03/2026
# Telefone                      | formatPhoneBR(v)       | (11) 98765-4321
# Tarifa c/ 4-6 casas decimais  | NÃO usar formatter     | R$ 0.756432/kWh
# Rótulo de eixo Y em gráfico   | NÃO usar formatter     | R$ 1,2k (inline)
#
# CASOS ESPECIAIS — NÃO substituir por formatter:
# - Tarifas de energia elétrica com 4-6 casas decimais → manter como está
# - Rótulos compactos de eixo Y em gráficos → manter expressão inline
# - Valores via prop formatCurrency → já está correto, não alterar
# - Tick formatters de gráfico (ex: `R$ ${(v/1000).toFixed(0)}k`) → manter

# ------------------------------------------------------------------------------
# §49-S1 — LOGGING (Regras v3.0)
# ------------------------------------------------------------------------------

# PERMITIDO:
console.error("[NomeDoModulo] Erro ao buscar dados:", error);   // sem outro tratamento
console.warn("[NomeDoModulo] Dado ausente, usando fallback");   // aviso intencional

# PROIBIDO em produção:
console.log("dados:", data);        // ❌ debug puro
console.log("clicou:", item);       // ❌ debug de evento
console.log("teste");               // ❌ teste manual

# Para debug temporário durante desenvolvimento:
// console.log("[debug] valor:", value);   // comentado, nunca ativo no commit

# Edge Functions — usar console.error com prefixo do módulo:
console.error("[nome-da-function] Error:", e);   // ✅ padrão EF-S1

# ------------------------------------------------------------------------------
# §50-S1 — MIGRAÇÕES PROGRESSIVAS (Regra para débito técnico v3.0)
# ------------------------------------------------------------------------------

# C-01 (183 queries diretas em componentes) — migração por módulo:
# NÃO migrar tudo de uma vez. Seguir esta ordem:
# 1. Auditar módulo-alvo: quais tabelas são acessadas?
# 2. Criar hook em src/hooks/ seguindo §16-S1
# 3. Substituir no componente
# 4. npm run build — 0 erros
# 5. Só então próximo módulo
#
# Prioridade sugerida de migração:
# Sprint A: ComissoesManager, EquipamentosManager (mais acessados)
# Sprint B: PerformanceDashboard, FollowUpManager
# Sprint C: FornecedoresManager, LeadForm
# Sprint D: demais

# =============================================================================
# BLOCO 4 — ANTI-PADRÕES (AP-XX)
# =============================================================================

# [Mantidos AP-01 a AP-20 da v2.5 integralmente]

AP-21 CORES HARDCODED EM GRÁFICOS (NOVO v3.0)
    ❌ Errado: stroke="#3b82f6", fill="#10b981", stopColor="#FF6600"
    ✅ Certo:  stroke="hsl(var(--primary))", fill="hsl(var(--success))"
    🔍 Detectar: grep -rn 'stopColor\|stroke="\#\|fill="\#' src/ --include="*.tsx" | grep -v "url(#\|context-stroke\|none"
    💥 Consequência: Gráficos quebram em dark mode, cores inconsistentes com tema

AP-22 FORMATTER ERRADO PARA TIPO DE DADO (NOVO v3.0)
    ❌ Errado: formatBRL(tarifa) onde tarifa = 0.756432 (perde precisão)
    ❌ Errado: formatBRL(economiaTotal) quando não precisa de centavos
    ✅ Certo:  escolher formatter pelo tipo — ver §48-S1
    🔍 Detectar: grep -rn "formatBRL(" src/ --include="*.tsx" | grep -i "tarif\|kwh\|rate"
    💥 Consequência: Tarifas de energia aparecem como R$ 0,76 em vez de R$ 0.756432/kWh

AP-23 CONSOLE.LOG EM PRODUÇÃO (NOVO v3.0)
    ❌ Errado: console.log("dados:", data) em componentes/hooks/pages
    ✅ Certo:  remover ou comentar — // console.log("dados:", data)
    ✅ Permitido: console.error() e console.warn() quando necessários
    🔍 Detectar: grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v "//"
    💥 Consequência: Dados sensíveis expostos no browser, performance degradada

AP-24 LOADING STATE BRANDED SUBSTITUÍDO POR SKELETON SIMPLES (NOVO v3.0)
    ❌ Errado: substituir <LoadingState /> ou <SunLoader /> por <Skeleton />
    ✅ Certo:  LoadingState e SunLoader são branded e superiores — manter
               Skeleton é para itens inline (linhas de tabela, cards individuais)
    🔍 Detectar: git diff | grep -A2 -B2 "LoadingState\|SunLoader" | grep "Skeleton"
    💥 Consequência: Regressão de UX — perde identidade visual da marca

# =============================================================================
# BLOCO 5 — DECISÕES ARQUITETURAIS (DA-XX)
# =============================================================================

# [Mantidos DA-01 a DA-11 da v2.5 integralmente]

DA-12 FORMATADORES POR TIPO, NÃO POR APARÊNCIA (NOVO v3.0)
    Contexto: Auditoria 2026-03 — ConcessionariasManager usava tarifas com 4-6 casas
              decimais. Se formatBRL fosse aplicado, perderia precisão crítica.
    Decisão: Escolher formatter pelo TIPO do dado (moeda? tarifa? potência?),
             não pelo visual desejado.
    Quando quebrar: NUNCA — a precisão do dado sempre prevalece sobre a aparência.

DA-13 LOADING STATES BRANDED SÃO DESIGN SYSTEM (NOVO v3.0)
    Contexto: Auditoria 2026-03 — LoadingState e SunLoader identificados como
              componentes branded com useLoadingConfig. Substituição por Skeleton
              seria regressão de identidade visual.
    Decisão: LoadingState = páginas inteiras. SunLoader = seções temáticas.
             Skeleton = itens inline. Os três coexistem com propósitos distintos.
    Quando quebrar: NUNCA — são componentes do design system do produto.

DA-14 MIGRAÇÃO PROGRESSIVA DE DÉBITO TÉCNICO (NOVO v3.0)
    Contexto: 183 queries diretas em componentes (C-01). Migração em massa
              causaria regressões em cascata.
    Decisão: Migrar por módulo, um por vez, com build verificado entre cada módulo.
             Priorizar por frequência de edição, não por tamanho do componente.
    Quando quebrar: NUNCA migrar mais de um módulo por PR sem revisão.

DA-15 ARQUITETURA DE VARIÁVEIS DE PROPOSTA — DOIS RESOLVERS (NOVO v3.2)
    Contexto: Auditoria 2026-04 — 59 variáveis existiam só no backend.
              O FE usa deepGet(finalSnapshot, key) como fallback automático.
    Decisão: Frontend (resolveProposalVariables.ts) = preview/audit no wizard.
             Backend (_shared/resolvers/) = geração do PDF.
             Fallback via snapshot elimina necessidade de duplicar lógica.
             Adicionar ao FE apenas se precisar de preview em tempo real.
    Quando quebrar: NUNCA duplicar lógica de cálculo entre FE e BE.
    Documentado em: AP-15 no resolver FE (comentário de topo).

# =============================================================================
# BLOCO 6 — REFERÊNCIA RÁPIDA DE PADRÕES (§1–§50)
# =============================================================================

# [Mantidos §1–§47 da v2.5 integralmente]

## §48. FORMATADORES — Tabela completa (v3.0)
→ Ver §48-S1 acima para tabela completa
Regra rápida: NUNCA formatar tarifa com formatBRL. NUNCA formatar inteiro com formatBRL.

## §49. LOGGING — Regras de produção (v3.0)
→ Ver §49-S1 acima
Regra rápida: console.log = proibido. console.error/warn = permitido com moderação.

## §50. DÉBITO TÉCNICO — Migração de queries (v3.0)
→ Ver §50-S1 acima
183 queries diretas em componentes aguardam migração progressiva por módulo.

# =============================================================================
# BLOCO 7 — VALIDAÇÃO AUTOMÁTICA (SCRIPT PRE-BUILD)
# =============================================================================

# [Mantido da v2.5 + novas verificações abaixo]

# ADICIONAR ao scripts/validate-agents.js existente:

// AP-23: console.log em produção
files.forEach(file => {
  if (!file.includes('node_modules')) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (/console\.log\(/.test(line) && !/^\s*\/\//.test(line)) {
        violations.push(`[AP-23] console.log ativo em ${file}:${idx+1}`);
      }
    });
  }
});

// AP-21: cores hardcoded em gráficos
files.forEach(file => {
  if (file.endsWith('.tsx')) {
    const content = fs.readFileSync(file, 'utf8');
    if (/stopColor="|stroke="#|fill="#/.test(content)) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (/stopColor="|stroke="#|fill="#/.test(line) && !/url\(#|context-stroke|none/.test(line) && !/\/\//.test(line)) {
          violations.push(`[AP-21] Cor hardcoded em gráfico ${file}:${idx+1}`);
        }
      });
    }
  }
});

// RB-16: formatBRL aplicado a tarifa (heurística)
files.forEach(file => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const content = fs.readFileSync(file, 'utf8');
    if (/formatBRL\(.*tarif|formatBRL\(.*rate|formatBRL\(.*kwh/i.test(content)) {
      violations.push(`[RB-16] Possível formatBRL em tarifa/kwh em ${file} — verificar manualmente`);
    }
  }
});

# =============================================================================
# BLOCO 8 — CONVENÇÕES DE NOMENCLATURA
# =============================================================================
# [Mantido integralmente da v2.5]

# =============================================================================
# BLOCO 9 — CHECKLIST FINAL ANTES DE COMMITAR
# =============================================================================

[ ] Build passa: npm run build (zero erros)
[ ] Lint passa: npm run lint
[ ] Validação AGENTS: npm run prebuild
[ ] Cores: Nenhum orange-*, blue-*, #hex em componentes novos
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
[ ] Edge Functions: sem loop com await em batch (AP-20)
[ ] Edge Functions: tenant_id validado em todas as queries
[ ] Catálogo: queries usam fornecedor_id, não source
[ ] Redeploy: se alterou _shared/*.ts, fez redeploy de template-preview + generate-proposal + docx-to-pdf

# =============================================================================
# BLOCO 10 — REGRESSÕES CONHECIDAS — NUNCA QUEBRAR
# =============================================================================

### WhatsApp / process-webhook-events
- extractMessageContent trata ephemeralMessage, audioMessage, documentMessage — NÃO alterar
- Nunca remover fallback msg.message || {}

### AuthForm / handleSignIn
- DEVE ter: const handleSignIn = async (data: LoginData) => { — nunca mover

### Edge Functions — deploy obrigatório
- Após alteração em supabase/functions/_shared/*.ts:
  redeploy: template-preview, generate-proposal, docx-to-pdf

### Snapshot camelCase — fallback duplo obrigatório
- pagamentoOpcoes ?? pagamento_opcoes (e demais campos)
- Nunca remover fallbacks de camelCase

### Resolvers de proposta — implementação paralela (AP-15)
- FRONTEND: src/lib/resolveProposalVariables.ts
- BACKEND:  supabase/functions/_shared/resolvers/
- Sempre sincronizar os dois

### Campos de kit — nomes corretos (AP-16)
- SEMPRE: modulo?.potencia_w, inversor?.potencia_w
- NUNCA:  modulo?.potencia (campo não existe)

### usePaybackEngine — queries useQuery (não reverter para useState)

### Itens inativos — opacity-50 obrigatório

### Catálogo multi-fornecedor
- NUNCA .eq("source", "edeltec") — usar .eq("fornecedor_id", id) ✅ CORRIGIDO v3.0
- NUNCA kit.source === "edeltec" — usar !!kit.fornecedor_id ✅ CORRIGIDO v3.0

### N+1 nas Edge Functions — CORRIGIDO v3.0
- detect-upsell-opportunities: batch SELECT + batch INSERT ✅
- calculate-gd-energy-month: batch invoices + batch allocations upsert + batch credits ✅
- google-contacts-integration: normalização pura + batch identity lookup ✅

### console.log — REMOVIDOS v3.0
- 132 console.log comentados em src/components/, src/pages/, src/hooks/ ✅
- supabase/functions/ não alterado (usa console.error com prefixo — correto)

### Modais sem w-[90vw] — BACKLOG LIMPO v3.0
- Arquivos do backlog v2.5 verificados: removidos ou corrigidos ✅

### Scroll sem min-h-0 — CORRIGIDO v3.0
- ModuloImportDialog, FornecedorImportDialog, ProjetoKanbanConsultor, MobileNav ✅

### Formatadores manuais R$ — CORRIGIDOS v3.0
- FormasPagamentoPage, ValidacaoVendasManager, BillingFeaturesPage ✅
- EnergiaDashboard (formatBRLInteger), EstoquePage (formatBRLInteger) ✅
- ItemsTable, MovementsTable ✅
- ConcessionariasManager: tarifas com 4-6 casas — CORRETO não usar formatter ✅

### Sprints Visuais — CONCLUÍDOS v3.1

#### V1 — Tabelas sem overflow-x-auto ✅
- 78 arquivos corrigidos
- Padrão: <div className="rounded-lg border border-border overflow-x-auto"><Table>
- NUNCA usar <Table> sem overflow-x-auto no container pai

#### V2 — Tabs sem overflow-x-auto ✅
- 12 arquivos corrigidos (TabsList não-grid)
- Padrão: <TabsList className="overflow-x-auto flex-wrap h-auto">
- <TabsTrigger className="shrink-0 whitespace-nowrap">
- EXCEÇÃO: TabsList com grid (layout fixo intencional) — NÃO adicionar overflow-x-auto

#### V3 — Grids sem breakpoint mobile ✅
- 130 linhas corrigidas em páginas admin e wizard
- Padrão: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- EXCEÇÃO: grids dentro de Dialog/Modal com layout fixo — manter como está
- EXCEÇÃO: grids de dados compactos (text-xs, font-mono) — manter como está

#### V4 — Tipografia inconsistente ✅
- 26 arquivos corrigidos
- Hierarquia definitiva (ver §DS-01):
  - Título página:    text-xl font-bold      (não font-semibold)
  - Título card/seção: text-base font-semibold (não font-bold)
  - KPI/métrica:      text-lg font-bold      (correto — manter)
- EXCEÇÃO: valores KPI/métrica com text-lg font-bold — correto, não alterar

#### V5 — Shadow e rounded fora do padrão ✅
- 20 elementos corrigidos
- Cards estáticos: shadow-sm (nunca shadow-lg)
- Cards com hover: hover:shadow-md (nunca hover:shadow-lg)
- Cards containers: rounded-xl máximo (nunca rounded-2xl)
- EXCEÇÃO: tooltips, dropdowns, modais, FAB — shadow-lg correto
- EXCEÇÃO: chat bubbles, avatares, ícones decorativos — rounded-2xl correto
- EXCEÇÃO: landing page institucional — estilo próprio, não alterar

### Migração C-01 — CONCLUÍDA v3.2
- Total de queries migradas: ~170
- Hooks criados: 40+
- supabase.from() restantes em componentes: 91 (writes imperativos em handlers — corretos per §16)
- PropostaPublica.tsx: página pública, aceitável per Bloco 10
- AuthForm.tsx: protegido per Bloco 10, não modificar

#### Hooks criados — Tabela completa

| Hook | Funções exportadas | Módulo |
|---|---|---|
| useSignatureData.ts | useSaveSignatureSettings, useDeleteSigner, useSaveSigner | SignatureTab |
| useTemplatePreview.ts | usePropostasParaPreview, buildPropostaContext | TemplatePreviewDialog |
| useMeterDetail.ts | useLinkedUC, useDeleteMeter | MeterDetailPage |
| useImportCsvAneel.ts | useConcessionariasForMatch, useInsertAneelSyncRun | ImportCsvAneelDialog |
| useWaInstances.ts | vendedoresQuery, instanceVendedoresQuery, saveVendedoresMutation | WaInstancesManager |
| useFiscalEmissao.ts | useFiscalInvoices, useFiscalMunicipalServices, useFiscalSettings, useFiscalInvoiceEvents, useCreateFiscalInvoice | FiscalEmissao |
| useVariableMapper.ts | useVariableMapperData | VariableMapperPanel |
| useBaseMeteorologica.ts | useAdminGuard, useIrradianceDatasetsAndVersions | BaseMeteorologicaPage |
| useFiscalWizard.ts | useFiscalWizardSettings, useFiscalWizardServices, useSaveFiscalSettings | FiscalWizard |
| useConvertLeadToClient.ts | useConversionEquipment | ConvertLeadToClientDialog |
| useAutoReplyConfig.ts | useAutoReplyConfigData, useSaveAutoReplyConfig | AutoReplyConfig |
| useParcelasManager.ts | useParcelasData, useGatewayActive | ParcelasManager |
| useEmailTemplates.ts | useEmailTemplatesList, useSaveEmailTemplate, useDeleteEmailTemplate, useDuplicateEmailTemplate | EmailTemplatesPage |
| useProjetoKanbanStage.ts | useKanbanAutomations, useKanbanStagePermissions | ProjetoKanbanStage |
| useFiscalLogs.ts | useFiscalProviderRequests, useFiscalProviderWebhooks | FiscalLogs |
| useDirectorOverview.ts | useLeadStats | DirectorOverview |
| useUsuarios.ts | useIsAdmin, useUsuariosList, useRefreshUsuarios | UsuariosManager |
| useConfSolar.ts | usePricingConfig, usePremissasTecnicas, usePropostaTemplates, usePropostaVariaveisCustom | conf-solar tabs |
| useAprovacaoUsuarios.ts | usePendingUsers, useRefreshPendingUsers | AprovacaoUsuarios |
| usePagamentosComissao.ts | usePagamentosComissao, useRefreshPagamentosComissao | PagamentosComissaoDialog |
| useRecebimentos.ts | useRecebimentosFull, useClientesAtivos, useRefreshRecebimentos | RecebimentosManager |
| useReleaseChecklist.ts | useReleaseHistory, useRefreshReleaseHistory | ReleaseChecklist |
| useServicos.ts | useServicosData, useRefreshServicos | ServicosManager |
| useVendedorMetas.ts | useVendedorMetasData, useRefreshVendedorMetas | VendedorMetasIndividuais |
| useVendedores.ts | useVendedoresList, useUserProfiles, useRefreshVendedores | VendedoresManager |
| useImportContaEnergia.ts | useConcessionariasAtivas | ImportContaEnergiaDialog |

### Gate de instalação — IMPLEMENTADO v3.2
- ProjetoInstalacaoTab.tsx: useQuery verifica proposta aceita
- Botões "Iniciar checklist" desabilitados sem proposta aceita
- Banner bg-warning/10 com AlertTriangle exibido

### Validação pré-geração — MELHORADA v3.2
- validatePropostaFinal.ts: adicionada verificação W6b (economia mensal)
- economiaMensal passada pelo ProposalWizard ao validador

### console.log em Edge Functions — LIMPO v3.2
- template-preview/index.ts: 24 console.log comentados
- Corrigidos 2 blocos multi-linha com corpo de objeto dangling

# =============================================================================
# BLOCO 11 — REGRAS DE ESCOPO
# =============================================================================

- Quando a tarefa diz "only touch X", NÃO tocar em outros arquivos
- Se encontrar outro bug, REPORTAR mas não corrigir — abrir tarefa separada
- Nunca "aproveitar" para refatorar código adjacente
- Migração de débito técnico (C-01): máximo 1 módulo por PR

# =============================================================================
# BLOCO 12 — DESIGN SYSTEM VISUAL (NOVO v3.0)
# Regras para consistência visual entre todas as telas
# =============================================================================

## §DS-01 TIPOGRAFIA — Hierarquia única

Elemento                  | Classes obrigatórias
--------------------------|--------------------------------------------------
Título de página (h1)     | text-xl font-bold text-foreground
Subtítulo de página       | text-sm text-muted-foreground
Título de card/seção (h2) | text-base font-semibold text-foreground
Label de campo            | text-sm font-medium text-foreground
Texto de corpo            | text-sm text-foreground
Texto auxiliar/hint       | text-xs text-muted-foreground
Valor numérico destaque   | text-2xl font-bold tracking-tight text-foreground
Valor monetário em tabela | text-sm font-mono text-foreground

NUNCA misture: font-bold com text-lg em título de card (reservado para página)
NUNCA use: text-base font-bold — use text-base font-semibold

## §DS-02 CARDS — Padrão único

// Card de conteúdo padrão:
<Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
  <CardContent className="p-5">
    {/* conteúdo */}
  </CardContent>
</Card>

// Card de KPI (métrica):
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

NUNCA use: shadow-lg em cards de lista (reservado para modais)
NUNCA use: rounded-2xl em cards (padrão é rounded-lg via border-radius do shadcn)

## §DS-03 ÍCONES NOS HEADERS — Padrão único

// Header de página:
<div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
  <Icon className="w-5 h-5" />
</div>

// Header de modal:
<div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
  <Icon className="w-5 h-5 text-primary" />
</div>

NUNCA use: ícone sem container colorido em headers
NUNCA varie: o tamanho do container entre telas (w-10 h-10 em páginas, w-9 h-9 em modais)

## §DS-04 ESPAÇAMENTO — Grid de 4px

Espaçamento interno de card:  p-5  (20px)
Gap entre cards:              gap-4 (16px) ou gap-6 (24px)
Gap entre seções na página:   space-y-6 (24px)
Gap entre campos de form:     space-y-4 (16px) ou grid gap-4
Padding de página:            p-4 md:p-6
Padding de modal body:        p-5

NUNCA use: p-3 em cards (muito apertado) ou p-8 (muito largo)
NUNCA use: margin direta em componentes filhos (AP-07) — usar gap/space no pai

## §DS-05 BADGES E STATUS — Padrão semântico

// Badge de status:
<Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
  Ativo
</Badge>

// Cores por semântica:
// Ativo/Concluído/Aprovado:  bg-success/10 text-success border-success/20
// Pendente/Em progresso:     bg-warning/10 text-warning border-warning/20
// Inativo/Cancelado/Erro:    bg-destructive/10 text-destructive border-destructive/20
// Informativo/Neutro:        bg-muted text-muted-foreground border-border
// Destaque/Principal:        bg-primary/10 text-primary border-primary/20

NUNCA use: bg-green-100 text-green-800 (cores fixas quebram dark mode)
NUNCA use: Badge variant="default" para status (reservado para ações)

## §DS-06 FORMULÁRIOS — Layout obrigatório

// Grid responsivo para formulários:
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label htmlFor="campo">Label do campo</Label>
    <Input id="campo" placeholder="Placeholder" />
  </div>
</div>

// Campo que ocupa linha inteira:
<div className="col-span-1 sm:col-span-2 space-y-2">

// Seções de formulário separadas:
<div className="space-y-4">
  <h3 className="text-base font-semibold text-foreground border-b border-border pb-2">
    Título da seção
  </h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* campos */}
  </div>
</div>

NUNCA use: flex para layout de formulário (use grid)
NUNCA use: margin-bottom em campos individuais (use gap no grid pai)

## §DS-07 TABELAS — Padrão visual

// Container obrigatório:
<div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableHead className="font-semibold text-foreground">Coluna</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow className="hover:bg-muted/30 cursor-pointer transition-colors">
        <TableCell className="text-foreground">Valor</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>

// Coluna de valor monetário:
<TableCell className="text-right font-mono text-sm text-foreground">
  {formatBRL(item.valor)}
</TableCell>

// Item inativo — obrigatório:
<TableRow className={cn("hover:bg-muted/30", !item.ativo && "opacity-50")}>

NUNCA use: tabela sem borda e sem rounded-lg no container
NUNCA use: TableHead sem font-semibold

## §DS-08 RESPONSIVIDADE — Breakpoints e comportamento

Breakpoint | Comportamento esperado
-----------|---------------------------------------------------------------
< 640px    | 1 coluna, botões full-width, ações em DropdownMenu
640-768px  | 2 colunas em grids, modais em 90vw
768-1024px | 2-3 colunas, tabelas com scroll horizontal se necessário
> 1024px   | Layout completo, botões inline em tabelas, sidebars visíveis

Regras de adaptação:
- Tabelas: sempre overflow-x-auto no container pai em mobile
- Botões de ação em tabela: hidden lg:flex inline, flex lg:hidden dropdown
- Modais: sempre w-[90vw] — nunca largura fixa
- Headers de página: flex-col sm:flex-row quando botões não cabem
- Grids: sempre começar com grid-cols-1, subir com sm: e lg:

# =============================================================================
# BLOCO 13 — SPRINTS CONCLUÍDOS (v3.2)
# =============================================================================

## Módulo Financeiro
- F1: Trigger trg_proposta_aceita_recebimento
- F2: Lançamentos financeiros avulsos
- F3: Fechamento de caixa com despesas
- F4: DRE mensal com gráfico e exportação CSV

## Gateways de Cobrança
- G1: Migration gateways em tenant_premises
- G2: Edge function gerar-cobranca
- G3: CobrancaDialog + ParcelasManager
- G4: PagamentosDialog (8 formas de pagamento)
- G5: Webhook automático PagSeguro/Asaas

## Conta Corrente do Cliente
- R1: Recebimentos como conta corrente
  (PagamentoLivreDialog, trigger sync_recebimento_total_pago)
- R2: WA automático ao receber pagamento
  (notificar-pagamento-wa edge function)
- R3: Cron diário de lembretes de vencimento
  (verificar-vencimentos edge function)
- R4: Botão cobrança manual por WA
  (enviar-cobranca-wa edge function)

## Integração Solaryum JNG/Vertys
- S1: Infrastructure (solaryum-proxy + TabIntegracoes)
- S2: IBGE propagado do cliente para WizardState
- S3: Aba Distribuidores no StepKitSelection

# =============================================================================
# BLOCO 14 — NOVAS REGRAS (v3.2)
# =============================================================================

RB-24 RECEBIMENTOS USAM MODELO CONTA CORRENTE
    Não criar parcelas fixas manualmente.
    Usar PagamentoLivreDialog para baixas avulsas.
    Status controlado pelo saldo (total_pago vs valor_total).

RB-25 WA AUTOMÁTICO É FIRE-AND-FORGET
    Nunca bloquear fluxo de pagamento por falha WA.
    Sempre usar .catch(() => {}) na chamada.
    Falha no WA = log de erro, não erro pro usuário.

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

# =============================================================================
# FIM DO AGENTS.md v3.2
# =============================================================================
