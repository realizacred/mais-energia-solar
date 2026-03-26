# AGENTS.md v2.4 — Mais Energia Solar CRM
# Padrões obrigatórios para geração de código via AI (Lovable, Copilot, etc.)
# Última atualização: 2026-03-26

# =============================================================================
# ⚠️ INSTRUÇÃO PRIMÁRIA PARA AI — LEIA PRIMEIRO
# =============================================================================

# SEMPRE siga estas regras na ordem de prioridade:
# 1. REGRAS BLOQUEANTES (Bloco 1) — NUNCA quebrar, build falha se descumprir
# 2. SNIPPETS OBRIGATÓRIOS (Bloco 3) — Copie e cole EXATAMENTE, não improvise
# 3. ANTI-PADRÕES (Bloco 4) — NUNCA faça isso, já foi proibido
# 4. DECISÕES (Bloco 5) — Entenda o "por que" antes de criar algo novo
# 5. BOAS PRÁTICAS (Bloco 2) — Siga quando não conflitar com 1-4

# DICA: Use o Índice Rápido (Bloco 0) para encontrar regras em 10 segundos

# =============================================================================
# BLOCO 0 — ÍNDICE RÁPIDO POR TIPO DE TAREFA
# =============================================================================

Estou criando... | Regras principais | Snippet obrigatório | Anti-padrões
---|---|---|---
**Novo componente React** | §1 (cores) → §22 (botões) → §32 (responsive) | §25-S1 (modal) | AP-02, AP-05, AP-07
**Nova query Supabase** | §16 (hooks) → §23 (staleTime) → §18 (RLS) | §16-S1 (hook) | AP-01
**Novo modal/drawer** | §25 (tamanhos) → §36 (scroll) → §39 (chat) | §25-S1 (modal) | AP-03, AP-04
**Novo input formulário** | §13 (inputs) → §2 (dark mode) → §33 (proposta) | §13 (lista) | AP-05
**Nova feature WhatsApp** | §39 (scroll chat) → §41 (avatar) → §43 (cron) | §39-S1 (chat) | AP-04
**Novo hook customizado** | §16 (estrutura) → §23 (staleTime) → §20 (SRP) | §16-S1 (hook) | AP-01
**Correção de bug visual** | §1 (cores) → Bloco 5 (validação) | — | AP-02, AP-03, AP-04
**Nova tela admin** | §6 (aproveitamento) → §26 (header) → §29 (abas) | §25-S1 (modal) | AP-06
**Nova tabela/lista** | §4 (tabela) → §12 (skeleton) → §34 (responsive) | §4-S1 (tabela) | AP-06
**Novo gráfico** | §5 (recharts) → §27 (KPI) | §5-S1 (gráfico) | —

# =============================================================================
# BLOCO 1 — REGRAS BLOQUEANTES (RB-XX)
# NUNCA quebrar. Build falha, PR é rejeitado, código é revertido.
# =============================================================================

RB-01 CORES SEMÂNTICAS OBRIGATÓRIAS
    NUNCA use: orange-*, blue-*, green-*, red-*, #FF6600, #3b82f6, text-orange-500, bg-blue-600
    SEMPRE use variáveis CSS:
      - Ação principal: bg-primary, text-primary, border-primary, bg-primary/10
      - Superfícies: bg-card, bg-background, bg-muted
      - Textos: text-foreground, text-muted-foreground, text-card-foreground
      - Bordas: border-border, border-input
      - Estados: bg-success, bg-warning, bg-destructive, bg-info
    → Ver §1 para exemplos visuais

RB-02 DARK MODE EM TODA TELA NOVA
    NUNCA use: bg-white, text-black, text-gray-500, border-gray-200
    SEMPRE use: bg-card, text-foreground, text-muted-foreground, border-border
    Teste: alterne entre light/dark no Storybook ou dev tools

RB-03 BOTÃO SHADCN OBRIGATÓRIO
    NUNCA use: &lt;button&gt; HTML nativo
    SEMPRE use: &lt;Button&gt; de @/components/ui/button
    Variantes por hierarquia:
      - Ação principal: variant="default" (sólido primário)
      - Ação secundária: variant="outline"
      - Destrutiva (remover): variant="outline" className="border-destructive text-destructive"
      - Cancelar/fechar: variant="ghost"
    → Ver §22 para tabela completa de variantes

RB-04 QUERIES SÓ EM HOOKS
    NUNCA faça: supabase.from() dentro de componente React
    SEMPRE use: hook em src/hooks/ com useQuery
    Estrutura obrigatória: useDados() → useBuscarDado() → useAtualizarDado()
    → Ver §16-S1 para template exato

RB-05 STALETIME OBRIGATÓRIO EM TODA QUERY
    NUNCA use: useQuery({ queryKey, queryFn }) sem staleTime
    Padrões:
      - Listas, formulários: staleTime: 1000 * 60 * 5 (5 min)
      - Dados em tempo real: staleTime: 1000 * 30 (30 seg)
      - Configurações estáticas: staleTime: 1000 * 60 * 15 (15 min)
    → Ver §23 para quando usar cada um

RB-06 SKELETON NO LOADING OBRIGATÓRIO
    NUNCA deixe: tela em branco, "Carregando..." texto solto, spinner sem estrutura
    SEMPRE use: Skeleton de @/components/ui/skeleton com estrutura similar ao conteúdo
    → Ver §12-S1 para templates de skeleton

RB-07 MODAL COM w-[90vw] OBRIGATÓRIO
    NUNCA use: max-w-* sozinho (ex: max-w-md, max-w-2xl)
    SEMPRE use: w-[90vw] max-w-[tamanho] (ex: w-[90vw] max-w-2xl)
    Motivo: aproveita tela em notebooks, evita margens desperdiçadas

RB-08 SCROLL INTERNO COM min-h-0 OBRIGATÓTIO
    NUNCA use: flex-1 overflow-y-auto sem min-h-0
    SEMPRE use: flex-1 min-h-0 overflow-y-auto
    Motivo: sem min-h-0, scroll não funciona em containers flex

RB-09 COMPONENTES EXISTENTES ANTES DE CRIAR NOVO
    NUNCA crie: input de telefone, CPF, endereço, moeda, data do zero
    SEMPRE verifique antes: src/components/{shared,ui-kit,ui}/
    Lista de componentes obrigatórios:
      - Telefone: PhoneInput de @/components/ui-kit/inputs/PhoneInput
      - CPF/CNPJ: CpfCnpjInput de @/components/shared/CpfCnpjInput
      - Endereço: AddressFields de @/components/shared/AddressFields
      - Moeda: CurrencyInput de @/components/ui-kit/inputs/CurrencyInput
      - Data: DateInput de @/components/ui-kit/inputs/DateInput

RB-10 RESPONSIVIDADE OBRIGATÓRIA
    NUNCA use: largura fixa em px (w-[400px], w-[500px])
    NUNCA use: max-w-* em páginas admin (exceto modais)
    SEMPRE use: 
      - Grids: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
      - Flex: flex-wrap, flex-1, min-w-0
      - Teste: 320px (mobile) e 1920px (desktop)

RB-11 HEADER DE PÁGINA ANTES DE ABAS
    NUNCA coloque: TabsList antes do título da página
    SEMPRE ordem: Header (ícone + título + subtítulo) → TabsList → Conteúdo
    → Ver §26-S1 para template de header

RB-12 NÃO MODIFICAR src/components/ui/
    NUNCA edite: arquivos em src/components/ui/ (exceto switch.tsx e slider.tsx)
    Motivo: shadcn/ui base, atualizações sobrescrevem mudanças
    Exceções permitidas: switch.tsx, slider.tsx (tokens semânticos)

RB-13 FUSO HORÁRIO BRASÍLIA OBRIGATÓRIO
    O sistema opera exclusivamente no fuso de Brasília (America/Sao_Paulo, UTC-3).
    NUNCA use: toLocaleString("pt-BR") sem timeZone — em ambientes cloud (preview, SSR) o fuso padrão é UTC.
    SEMPRE use: toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    SEMPRE use: toLocaleTimeString("pt-BR", { ..., timeZone: "America/Sao_Paulo" })
    SEMPRE use: toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    Para date-fns: Usar helpers de src/services/monitoring/plantStatusEngine.ts (getTodayBrasilia, isBrasiliaNight, etc.)
    Para Edge Functions (Deno): Usar new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    Motivo: Preview do Lovable roda em UTC — horários aparecem +3h adiantados se não forçar o fuso.

# =============================================================================
# BLOCO 2 — BOAS PRÁTICAS (RECOMENDADO, NÃO BLOQUEANTE)
# =============================================================================

BP-01 FRAMER MOTION EM ENTRADAS
    Animate cards e listas com stagger para UX premium
    → Ver §7 para variants padrão

BP-02 TOOLTIP EM TEXTO TRUNCADO MOBILE
    Use Tooltip quando texto é cortado em telas pequenas

BP-03 FORMATADORES CENTRALIZADOS
    NUNCA formate manualmente: use formatBRL, formatKwh, formatDateBR de src/lib/formatters

BP-04 LÓGICA EM SERVICES, NÃO COMPONENTES
    Regras de negócio em src/services/, não em componentes visuais

BP-05 PRINCÍPIOS DE ENGENHARIA
    SRP, DRY, SSOT, KISS, YAGNI. Patches incrementais, não rewrites.

BP-06 SAFE QUERY PATTERNS
    Respeite tenant isolation, evite selects desnecessários, não quebre RLS

# =============================================================================
# BLOCO 3 — SNIPPETS OBRIGATÓRIOS (COPIE E COLE — NÃO IMPROVISE)
# =============================================================================

# Use estes templates EXATOS. Não remova comentários, não mude estrutura.
# Cada snippet tem: [CÓDIGO] + [EXPLICAÇÃO] + [VARIAÇÕES PERMITIDAS]

# ------------------------------------------------------------------------------
# §16-S1 — HOOK COM SUPABASE (Template Obrigatório)
# ------------------------------------------------------------------------------

// src/hooks/useNOME.ts
// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório — ajuste conforme tipo de dado

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Interfaces exportadas para reuso
export interface NomeInterface {
  id: string;
  tenant_id: string;
  // ... outros campos
  created_at: string;
  updated_at: string;
}

// Constantes de configuração
const STALE_TIME = 1000 * 60 * 5; // 5 minutos — ajuste se necessário
const QUERY_KEY = "nome" as const;

/**
 * Hook para listar dados do tenant
 * §18: Respeita tenant isolation automaticamente via RLS
 */
export function useNOME(tenantId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: async () =&gt; {
      const { data, error } = await supabase
        .from("tabela")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as NomeInterface[];
    },
    staleTime: STALE_TIME, // §23: NUNCA remover
    enabled: !!tenantId, // Só executa se tenantId existe
  });
}

/**
 * Hook para buscar item específico
 */
export function useNOMEById(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, "detail", id],
    queryFn: async () =&gt; {
      if (!id) return null;
      const { data, error } = await supabase
        .from("tabela")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as NomeInterface;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

/**
 * Mutation para criar/atualizar
 */
export function useSalvarNOME() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: Omit&lt;NomeInterface, "id" | "created_at" | "updated_at"&gt; & { id?: string }) =&gt; {
      const { id, ...rest } = payload;
      
      if (id) {
        // Update
        const { data, error } = await supabase
          .from("tabela")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from("tabela")
          .insert({ ...rest, created_at: new Date().toISOString() })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data, variables) =&gt; {
      // Invalida queries afetadas
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      if (variables.id) {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY, "detail", variables.id] });
      }
    },
  });
}

/**
 * Mutation para deletar
 */
export function useDeletarNOME() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) =&gt; {
      const { error } = await supabase.from("tabela").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =&gt; {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// VARIAÇÕES PERMITIDAS:
// - STALE_TIME: 30s para realtime, 15min para configs
// - Adicionar filtros no .eq() ou .in()
// - Adicionar .limit() para paginação
// - NUNCA remover staleTime ou enabled

# ------------------------------------------------------------------------------
# §25-S1 — MODAL/DIALOG (Template Obrigatório)
# ------------------------------------------------------------------------------

// §25: Modal padrão — copie e adapte o conteúdo interno
// RB-07: w-[90vw] obrigatório
// §36: flex-1 min-h-0 obrigatório para scroll interno

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NomeIcon } from "lucide-react"; // Substitua pelo ícone correto

interface NomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) =&gt; void;
  // ... outras props específicas
}

export function NomeModal({ open, onOpenChange }: NomeModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSalvar = async () =&gt; {
    setIsLoading(true);
    try {
      // ... lógica de salvar
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    &lt;Dialog open={open} onOpenChange={onOpenChange}&gt;
      {/* RB-07: w-[90vw] obrigatório */}
      &lt;DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"&gt;
        
        {/* HEADER — §25: ícone + título + subtítulo obrigatórios */}
        &lt;DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0"&gt;
          &lt;div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"&gt;
            &lt;NomeIcon className="w-5 h-5 text-primary" /&gt;
          &lt;/div&gt;
          &lt;div className="flex-1"&gt;
            &lt;DialogTitle className="text-base font-semibold text-foreground"&gt;
              Título do Modal
            &lt;/DialogTitle&gt;
            &lt;p className="text-xs text-muted-foreground mt-0.5"&gt;
              Descrição curta explicando o que fazer neste modal
            &lt;/p&gt;
          &lt;/div&gt;
        &lt;/DialogHeader&gt;

        {/* CORPO — §36: ScrollArea com flex-1 min-h-0 obrigatório */}
        &lt;ScrollArea className="flex-1 min-h-0"&gt;
          &lt;div className="p-5 space-y-5"&gt;
            {/* 
              Conteúdo do modal aqui
              Use grid-cols-1 sm:grid-cols-2 para formulários
              Use space-y-4 para seções verticais
            */}
          &lt;/div&gt;
        &lt;/ScrollArea&gt;

        {/* FOOTER — §22: Botões shadcn, alinhados à direita */}
        &lt;DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0"&gt;
          &lt;Button 
            variant="outline" 
            onClick={() =&gt; onOpenChange(false)}
            disabled={isLoading}
          &gt;
            Cancelar
          &lt;/Button&gt;
          &lt;Button 
            onClick={handleSalvar}
            disabled={isLoading}
          &gt;
            {isLoading ? "Salvando..." : "Salvar"}
          &lt;/Button&gt;
        &lt;/DialogFooter&gt;
      &lt;/DialogContent&gt;
    &lt;/Dialog&gt;
  );
}

// VARIAÇÕES PERMITIDAS:
// - max-w-md (simples), max-w-2xl (padrão), max-w-3xl (complexo), max-w-[1100px] (wizard)
// - Remover ScrollArea se conteúdo for pequeno (mas mantenha flex-1 min-h-0 no div)
// - Adicionar seções com border-t border-border entre elas
// - NUNCA remover w-[90vw] ou shrink-0

# ------------------------------------------------------------------------------
# §36-S1 — SCROLL INTERNO (Template Obrigatório)
# ------------------------------------------------------------------------------

// §36: Layout flex com scroll interno — use para listas, chats, painéis
// RB-08: min-h-0 obrigatório em flex-1

&lt;div className="flex flex-col h-full min-h-0 overflow-hidden"&gt;
  {/* Header fixo — nunca encolhe */}
  &lt;div className="shrink-0 p-4 border-b border-border"&gt;
    {/* Título, botões, filtros */}
  &lt;/div&gt;
  
  {/* Conteúdo rolável — RB-08: flex-1 + min-h-0 OBRIGATÓRIO */}
  &lt;div className="flex-1 min-h-0 overflow-y-auto"&gt;
    {/* Lista, tabela, chat, formulário longo */}
  &lt;/div&gt;
  
  {/* Footer fixo (opcional) — nunca encolhe */}
  &lt;div className="shrink-0 p-4 border-t border-border"&gt;
    {/* Input, botões de ação, paginação */}
  &lt;/div&gt;
&lt;/div&gt;

// VARIAÇÕES:
// - Use ScrollArea do shadcn em vez de div se quiser estilização customizada
// - Altura fixa: h-[calc(100vh-3.5rem)] em vez de h-full
// - Sem footer: remova último shrink-0

# ------------------------------------------------------------------------------
# §39-S1 — WHATSAPP INBOX LAYOUT (Template Obrigatório)
# ------------------------------------------------------------------------------

// §39: NUNCA scroll global na página do inbox
// Cada coluna é container independente com scroll próprio

&lt;div className="flex h-[calc(100vh-3.5rem)] overflow-hidden"&gt;
  {/* Coluna 1: Lista de conversas — 320px fixo */}
  &lt;div className="w-80 flex flex-col h-full overflow-hidden border-r border-border shrink-0"&gt;
    &lt;div className="shrink-0 p-4 border-b border-border"&gt;
      {/* Header: título, busca, filtros */}
    &lt;/div&gt;
    &lt;div className="flex-1 min-h-0 overflow-y-auto"&gt;
      {/* Lista de conversas (Virtuoso ou div) */}
    &lt;/div&gt;
  &lt;/div&gt;

  {/* Coluna 2: Chat — flex-1 ocupa restante */}
  &lt;div className="flex-1 flex flex-col h-full overflow-hidden"&gt;
    &lt;div className="shrink-0 p-4 border-b border-border flex items-center justify-between"&gt;
      {/* Header: avatar, nome, temperamento badge, ações */}
      &lt;div className="flex items-center gap-3"&gt;
        &lt;Avatar /&gt;
        &lt;div&gt;
          &lt;p className="font-medium text-foreground"&gt;Nome do Lead&lt;/p&gt;
          &lt;IntelligenceBadge temperamento="morno" urgenciaScore={65} /&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
    
    &lt;div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4"&gt;
      {/* Mensagens do chat */}
    &lt;/div&gt;
    
    &lt;div className="shrink-0 p-4 border-t border-border"&gt;
      {/* Input de mensagem + botões */}
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/div&gt;

// VARIAÇÕES:
// - Mobile: esconder coluna 1 quando coluna 2 ativa (drawer ou slide)
// - Detalhes: adicionar coluna 3 (300px) com info do lead

# ------------------------------------------------------------------------------
# §4-S1 — TABELA PADRÃO (Template Obrigatório)
# ------------------------------------------------------------------------------

// §4: Sempre use componente Table do shadcn, nunca div ou HTML nativo
// §34: align-middle obrigatório em TableRow e TableCell

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

&lt;div className="rounded-lg border border-border overflow-hidden"&gt;
  &lt;Table&gt;
    &lt;TableHeader&gt;
      &lt;TableRow className="bg-muted/50 hover:bg-muted/50"&gt;
        &lt;TableHead className="font-semibold text-foreground w-[200px]"&gt;Cliente&lt;/TableHead&gt;
        &lt;TableHead className="font-semibold text-foreground"&gt;Status&lt;/TableHead&gt;
        &lt;TableHead className="font-semibold text-foreground text-right"&gt;Valor&lt;/TableHead&gt;
        &lt;TableHead className="w-[60px]" /&gt; {/* Coluna ações */}
      &lt;/TableRow&gt;
    &lt;/TableHeader&gt;
    &lt;TableBody&gt;
      {items.map((item) =&gt; (
        &lt;TableRow
          key={item.id}
          className="hover:bg-muted/30 cursor-pointer transition-colors"
          onClick={() =&gt; handleOpen(item)}
        &gt;
          &lt;TableCell className="font-medium text-foreground"&gt;{item.nome}&lt;/TableCell&gt;
          &lt;TableCell&gt;
            &lt;Badge variant="outline" className="text-xs"&gt;
              {item.status}
            &lt;/Badge&gt;
          &lt;/TableCell&gt;
          &lt;TableCell className="text-right font-mono text-sm"&gt;
            {formatBRLCompact(item.valor)}
          &lt;/TableCell&gt;
          &lt;TableCell&gt;
            {/* §34: Desktop = botões inline, Mobile = dropdown */}
            &lt;div className="hidden lg:flex items-center gap-1"&gt;
              &lt;Button variant="ghost" size="icon" className="h-7 w-7"&gt;
                &lt;Eye className="w-4 h-4 text-primary" /&gt;
              &lt;/Button&gt;
              &lt;Button variant="ghost" size="icon" className="h-7 w-7"&gt;
                &lt;Pencil className="w-4 h-4 text-warning" /&gt;
              &lt;/Button&gt;
            &lt;/div&gt;
            &lt;div className="flex lg:hidden"&gt;
              &lt;DropdownMenu&gt;
                &lt;DropdownMenuTrigger asChild&gt;
                  &lt;Button variant="ghost" size="icon" className="h-7 w-7"&gt;
                    &lt;MoreHorizontal className="w-4 h-4" /&gt;
                  &lt;/Button&gt;
                &lt;/DropdownMenuTrigger&gt;
                &lt;DropdownMenuContent align="end"&gt;
                  &lt;DropdownMenuItem&gt;Ver detalhes&lt;/DropdownMenuItem&gt;
                  &lt;DropdownMenuItem&gt;Editar&lt;/DropdownMenuItem&gt;
                  &lt;DropdownMenuItem className="text-destructive"&gt;Excluir&lt;/DropdownMenuItem&gt;
                &lt;/DropdownMenuContent&gt;
              &lt;/DropdownMenu&gt;
            &lt;/div&gt;
          &lt;/TableCell&gt;
        &lt;/TableRow&gt;
      ))}
    &lt;/TableBody&gt;
  &lt;/Table&gt;
&lt;/div&gt;

# ------------------------------------------------------------------------------
# §12-S1 — SKELETON STATES (Templates Obrigatórios)
# ------------------------------------------------------------------------------

// §12: NUNCA tela em branco durante loading

// Skeleton de card KPI (4 cards)
&lt;div className="grid grid-cols-2 md:grid-cols-4 gap-4"&gt;
  {Array.from({ length: 4 }).map((_, i) =&gt; (
    &lt;Card key={i} className="p-5"&gt;
      &lt;Skeleton className="h-8 w-24 mb-2" /&gt;
      &lt;Skeleton className="h-4 w-32" /&gt;
    &lt;/Card&gt;
  ))}
&lt;/div&gt;

// Skeleton de tabela (6 linhas)
&lt;div className="space-y-2"&gt;
  {Array.from({ length: 6 }).map((_, i) =&gt; (
    &lt;Skeleton key={i} className="h-12 w-full rounded-lg" /&gt;
  ))}
&lt;/div&gt;

// Skeleton de lista/chat
&lt;div className="space-y-4"&gt;
  {Array.from({ length: 5 }).map((_, i) =&gt; (
    &lt;div key={i} className="flex items-center gap-3"&gt;
      &lt;Skeleton className="h-10 w-10 rounded-full" /&gt;
      &lt;div className="flex-1"&gt;
        &lt;Skeleton className="h-4 w-3/4 mb-2" /&gt;
        &lt;Skeleton className="h-3 w-1/2" /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  ))}
&lt;/div&gt;

// Skeleton de formulário
&lt;div className="space-y-4"&gt;
  &lt;div className="grid grid-cols-1 sm:grid-cols-2 gap-4"&gt;
    &lt;Skeleton className="h-10 w-full" /&gt;
    &lt;Skeleton className="h-10 w-full" /&gt;
  &lt;/div&gt;
  &lt;Skeleton className="h-10 w-full" /&gt;
  &lt;Skeleton className="h-32 w-full" /&gt;
&lt;/div&gt;

# ------------------------------------------------------------------------------
# §26-S1 — HEADER DE PÁGINA (Template Obrigatório)
# ------------------------------------------------------------------------------

// §26: Header padronizado para todas as páginas admin
// RB-11: Sempre antes de TabsList

&lt;div className="flex items-center justify-between mb-6"&gt;
  &lt;div className="flex items-center gap-3"&gt;
    &lt;div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"&gt;
      &lt;NomeIcon className="w-5 h-5" /&gt;
    &lt;/div&gt;
    &lt;div&gt;
      &lt;h1 className="text-xl font-bold text-foreground"&gt;Título da Página&lt;/h1&gt;
      &lt;p className="text-sm text-muted-foreground"&gt;Subtítulo descritivo&lt;/p&gt;
    &lt;/div&gt;
  &lt;/div&gt;
  &lt;div className="flex items-center gap-2"&gt;
    &lt;Button variant="outline" size="sm"&gt;Exportar&lt;/Button&gt;
    &lt;Button size="sm"&gt;+ Novo&lt;/Button&gt;
  &lt;/div&gt;
&lt;/div&gt;

// Depois do header, se houver abas:
&lt;Tabs defaultValue="tab1"&gt;
  &lt;TabsList&gt;
    &lt;TabsTrigger value="tab1"&gt;Aba 1&lt;/TabsTrigger&gt;
    &lt;TabsTrigger value="tab2"&gt;Aba 2&lt;/TabsTrigger&gt;
  &lt;/TabsList&gt;
  {/* ... */}
&lt;/Tabs&gt;

# ------------------------------------------------------------------------------
# §27-S1 — KPI CARD PADRÃO (Template Obrigatório)
# ------------------------------------------------------------------------------

// §27: ÚNICO padrão para cards de métrica/número

&lt;Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow"&gt;
  &lt;CardContent className="flex items-center gap-4 p-5"&gt;
    &lt;div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0"&gt;
      &lt;NomeIcon className="w-5 h-5" /&gt;
    &lt;/div&gt;
    &lt;div&gt;
      &lt;p className="text-2xl font-bold tracking-tight text-foreground leading-none"&gt;
        R$ 0,00
      &lt;/p&gt;
      &lt;p className="text-sm text-muted-foreground mt-1"&gt;Label do card&lt;/p&gt;
    &lt;/div&gt;
  &lt;/CardContent&gt;
&lt;/Card&gt;

// Variações de cor (estados):
// border-l-primary + bg-primary/10 (padrão)
// border-l-destructive + bg-destructive/10 (urgente/alerta)
// border-l-success + bg-success/10 (positivo/crescimento)
// border-l-warning + bg-warning/10 (atenção/pendente)

# ------------------------------------------------------------------------------
# §5-S1 — GRÁFICO RECHARTS (Template Obrigatório)
# ------------------------------------------------------------------------------

// §5: Sempre use variáveis CSS, nunca cores hardcoded

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Tooltip customizado — padrão obrigatório
const CustomTooltip = ({ active, payload, label }: any) =&gt; {
  if (!active || !payload?.length) return null;
  return (
    &lt;div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm"&gt;
      &lt;p className="font-medium text-foreground mb-1"&gt;{label}&lt;/p&gt;
      {payload.map((p: any) =&gt; (
        &lt;p key={p.name} className="text-muted-foreground"&gt;
          {p.name}: &lt;span className="font-semibold text-foreground"&gt;{p.value}&lt;/span&gt;
        &lt;/p&gt;
      ))}
    &lt;/div&gt;
  );
};

&lt;ResponsiveContainer width="100%" height={220}&gt;
  &lt;AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}&gt;
    &lt;defs&gt;
      &lt;linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1"&gt;
        &lt;stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} /&gt;
        &lt;stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /&gt;
      &lt;/linearGradient&gt;
    &lt;/defs&gt;
    &lt;CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /&gt;
    &lt;XAxis 
      dataKey="mes" 
      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
      axisLine={false} 
      tickLine={false} 
    /&gt;
    &lt;YAxis 
      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
      axisLine={false} 
      tickLine={false} 
    /&gt;
    &lt;Tooltip content={&lt;CustomTooltip /&gt;} /&gt;
    &lt;Area 
      type="monotone" 
      dataKey="valor" 
      stroke="hsl(var(--primary))" 
      fill="url(#gradPrimary)" 
      strokeWidth={2} 
      dot={false} 
    /&gt;
  &lt;/AreaChart&gt;
&lt;/ResponsiveContainer&gt;

# =============================================================================
# BLOCO 4 — ANTI-PADRÕES (AP-XX) — NUNCA FAÇA ISSO
# =============================================================================

# Cada item: [O que é] → [Por que quebra] → [Como detectar no build]

AP-01 QUERY DIRETA NO COMPONENTE
    ❌ Errado: useEffect + supabase.from() dentro do componente
    ✅ Certo: useQuery em hook separado (§16-S1)
    🔍 Detectar: grep -rn "supabase.from" src/components/ --include="*.tsx"
    💥 Consequência: Queries não cacheadas, múltiplas requisições, código não testável

AP-02 COR FIXA PARA DESTAQUE
    ❌ Errado: &lt;Badge className="bg-red-500"&gt;Urgente&lt;/Badge&gt; ou bg-blue-600
    ✅ Certo: &lt;Badge className="bg-destructive/10 text-destructive border-destructive/20"&gt;Urgente&lt;/Badge&gt;
    🔍 Detectar: grep -rn "bg-\(red\|green\|blue\|orange\|yellow\)-[0-9]\|#[0-9a-fA-F]\{3,6\}" src/components/
    💥 Consequência: Quebra dark mode, inconsistência visual entre telas

AP-03 MODAL SEM w-[90vw]
    ❌ Errado: &lt;DialogContent className="max-w-2xl"&gt;
    ✅ Certo: &lt;DialogContent className="w-[90vw] max-w-2xl"&gt;
    🔍 Detectar: grep -rn 'DialogContent.*max-w-' src/ | grep -v 'w-\[90vw\]'
    💥 Consequência: Margens desperdiçadas em notebooks, layout quebrado em mobile

AP-04 SCROLL SEM min-h-0
    ❌ Errado: &lt;div className="flex-1 overflow-y-auto"&gt;
    ✅ Certo: &lt;div className="flex-1 min-h-0 overflow-y-auto"&gt;
    🔍 Detectar: grep -rn "flex-1.*overflow-y-auto" src/ | grep -v "min-h-0"
    💥 Consequência: Scroll não funciona, conteúdo cortado, overflow incorreto

AP-05 BOTÃO HTML NATIVO
    ❌ Errado: &lt;button onClick={...}&gt;Clique&lt;/button&gt;
    ✅ Certo: &lt;Button onClick={...}&gt;Clique&lt;/Button&gt; de @/components/ui/button
    🔍 Detectar: grep -rn "&lt;button" src/components/ --include="*.tsx"
    💥 Consequência: Estilo inconsistente, sem variantes, sem acessibilidade do shadcn

AP-06 LOADING SEM SKELETON
    ❌ Errado: {isLoading && &lt;p&gt;Carregando...&lt;/p&gt;} ou spinner solto
    ✅ Certo: {isLoading && &lt;Skeleton className="h-12 w-full" /&gt;} (§12-S1)
    🔍 Detectar: grep -rn "Carregando\|Loading\|Aguarde" src/components/ --include="*.tsx"
    💥 Consequência: Tela piscando, UX degradada, layout shift

AP-07 MARGIN PARA ESPAÇAR COMPONENTES
    ❌ Errado: &lt;Card className="mb-4"&gt;...&lt;/Card&gt; ou mt-4, ml-2, etc.
    ✅ Certo: &lt;div className="space-y-4"&gt;&lt;Card&gt;...&lt;/Card&gt;&lt;/div&gt; (gap/space no pai)
    🔍 Detectar: grep -rn "\(mb\|mt\|ml\|mr\)-[0-9]" src/components/ | grep -v "space-"
    💥 Consequência: Espaçamento inconsistente, difícil manter, quebra em refactors

AP-08 COMPONENTE DUPLICADO
    ❌ Errado: Criar novo PhoneInput quando já existe em ui-kit
    ✅ Certo: Verificar src/components/{shared,ui-kit,ui}/ antes de criar
    🔍 Detectar: Audit manual (não automatizável)
    💥 Consequência: 5 inputs de telefone diferentes no mesmo projeto, manutenção caótica

AP-09 QUERY SEM STALETIME
    ❌ Errado: useQuery({ queryKey, queryFn }) sem staleTime
    ✅ Certo: useQuery({ queryKey, queryFn, staleTime: 5 * 60 * 1000 })
    🔍 Detectar: grep -rn "useQuery(" src/hooks/ --include="*.ts" | grep -v "staleTime"
    💥 Consequência: Refetch desnecessário, tela piscando, gasto de API

AP-10 TABS ANTES DO HEADER
    ❌ Errado: &lt;TabsList&gt; antes do título da página
    ✅ Certo: Header (§26-S1) → TabsList → Conteúdo (RB-11)
    🔍 Detectar: grep -A5 "TabsList" src/pages/ --include="*.tsx" | grep -B5 "h1\|text-xl"
    💥 Consequência: Hierarquia visual confusa, usuário perdido, inconsistência

AP-11 IMAGEM SEM SIGNED URL
    ❌ Errado: &lt;img src={`${supabaseUrl}/storage/v1/object/public/${path}`} /&gt;
    ✅ Certo: &lt;img src={signedUrl} /&gt; onde signedUrl = createSignedUrl(path, 3600)
    🔍 Detectar: grep -rn "storage/v1/object/public" src/ --include="*.tsx"
    💥 Consequência: Imagens quebram, segurança comprometida, não funciona em produção

AP-12 FORMULÁRIO SEM ZOD/REACT-HOOK-FORM
    ❌ Errado: useState para cada campo + validação manual
    ✅ Certo: react-hook-form + zod resolver (padrão já existente no projeto)
    🔍 Detectar: grep -rn "useState.*set.*value\|onChange.*set" src/components/ | grep -i "form"
    💥 Consequência: Validação inconsistente, código verboso, bugs de estado

AP-13 DATA/HORA SEM FUSO BRASÍLIA
    ❌ Errado: new Date(timestamp).toLocaleString("pt-BR") — mostra UTC no cloud
    ✅ Certo: new Date(timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    🔍 Detectar: grep -rn 'toLocaleString\|toLocaleTimeString\|toLocaleDateString' src/ | grep -v 'timeZone'
    💥 Consequência: Horários aparecem +3h adiantados no preview e deploy (Lovable roda em UTC)

AP-14 MOEDA/KWP SEM FORMATTER CENTRALIZADO
    ❌ Errado: `R$ ${valor}`, `${potencia} kWp`, concatenação manual de unidades monetárias
    ✅ Certo:
      - Moeda:    formatBRL(valor)        → R$ 1.234,56
      - Compacto: formatBRLCompact(valor) → R$ 1,2k
      - Potência: formatKwh(potencia)     → 6,1 kWp
      - Nulo:     valor != null ? formatBRL(valor) : "—"
    🔍 Detectar: grep -rn 'R\$\s*\${' src/components/ --include="*.tsx"
    💥 Consequência: Casas decimais inconsistentes (R$ 575 em vez de R$ 575,00)

AP-15 VARIÁVEL DE PROPOSTA SEM IMPLEMENTAÇÃO NOS DOIS RESOLVERS
    ❌ Errado: Adicionar variável apenas em resolveProposalVariables.ts (frontend)
               ou apenas em _shared/resolvers/ (backend) — nunca só em um lado
    ✅ Certo: Toda variável nova de proposta DEVE ser implementada nos dois:
      1. src/lib/resolveProposalVariables.ts  → usado no preview/audit do sistema
      2. supabase/functions/_shared/resolvers/ → usado na geração real do PDF
    🔍 Detectar: comparar catálogo de variáveis com implementações nos dois arquivos
    💥 Consequência: Preview mostra valor correto mas PDF sai em branco (ou vice-versa)
    ⚠️ Após implementar: sempre fazer redeploy das edge functions afetadas (ver Bloco 10)

AP-16 CAMPO DE KIT COM NOME ERRADO NO RESOLVER
    ❌ Errado: modulo?.potencia, inversor?.potencia (campo não existe)
    ✅ Certo:  modulo?.potencia_w, inversor?.potencia_w (campo real na tabela kit_itens)
    🔍 Detectar: grep -rn '\.potencia[^_]' src/lib/resolveProposalVariables.ts
    💥 Consequência: Variáveis de potência de módulo/inversor retornam null → "–" no PDF

# =============================================================================
# BLOCO 5 — DECISÕES ARQUITETURAIS (DA-XX)
# POR QUE fizemos assim? QUANDO quebrar a regra?
# =============================================================================

DA-01 QUERIES SÓ EM HOOKS (§16)
    Contexto: 2024 — queries espalhadas em 40+ componentes. Mudança na API = editar 40 arquivos.
    Decisão: Centralizar em src/hooks/. Hoje mudamos 1 hook, afeta todos.
    Quando quebrar: NUNCA. Exceção: queries locais de autocomplete com debounce (useCallback).

DA-02 STALETIME OBRIGATÓRIO (§23)
    Contexto: React Query refetcha em window focus. Usuários: "tela pisca toda hora!"
    Decisão: 5 min padrão. Dados realtime (chat): 30 seg.
    Quando quebrar: Dados que MUDAM constantemente (preço Bitcoin, chat ativo, notificações).

DA-03 SEM max-w-* EM ADMIN (§21)
    Contexto: Dashboards antigos deixavam 30% tela em branco em monitores 1920px.
    Decisão: w-full obrigatório em páginas admin.
    Quando quebrar: Páginas públicas (landing) onde legibilidade &gt; aproveitamento.

DA-04 COMPONENTES REUTILIZÁVEIS (§13)
    Contexto: 2023 — 5 inputs de telefone diferentes no mesmo projeto.
    Decisão: SEMPRE verificar src/components/{shared,ui-kit,ui}/ antes de criar novo.
    Quando quebrar: Quando componente existente NÃO atende 80% do caso de uso (ex: necessita comportamento muito específico).

DA-05 MODAIS COM w-[90vw] (RB-07)
    Contexto: Monitores 1920px com max-w-3xl deixavam 600px de margem vazia.
    Decisão: w-[90vw] aproveita espaço, ainda limitado por max-w-*.
    Quando quebrar: NUNCA. Todas as telas se beneficiam.

DA-06 SRP EM HOOKS (§20)
    Contexto: Hooks gigantes fazendo 10 coisas diferentes, difíceis de testar.
    Decisão: useBuscarX, useCriarX, useAtualizarX, useDeletarX separados.
    Quando quebrar: Quando operações são atômicas e sempre usadas juntas (ex: useSalvar que cria ou atualiza).

DA-07 DARK MODE FIRST (§2)
    Contexto: Implementar dark mode depois = duplicar trabalho, inconsistências.
    Decisão: Toda tela nova já nasce com dark mode (variáveis semânticas).
    Quando quebrar: Componentes que SÓ existem em um modo (ex: canvas de assinatura branco).

DA-08 RESPONSIVIDADE MOBILE-FIRST (§32)
    Contexto: 60% dos usuários acessam via mobile, mas devs testam em desktop.
    Decisão: grid-cols-1 sm:grid-cols-2 (mobile primeiro, breakpoint sobe).
    Quando quebrar: Features desktop-only (ex: dashboard analítico complexo).

# =============================================================================
# BLOCO 6 — REFERÊNCIA RÁPIDA DE PADRÕES (§1–§44)
# =============================================================================

# Use Ctrl+F para encontrar. Seção completa para consulta.

## §1. IDENTIDADE VISUAL — Cores semânticas

Variável | Uso | NUNCA substituir por
---|---|---
bg-primary | Botões primários, badges ativos, ícones | orange-500, blue-600, #FF6600
bg-primary/10 | Fundo suave de ícones, badges outline | orange-50, blue-50
bg-card | Cards, modais, dropdowns | bg-white, bg-gray-100
bg-background | Fundo da página | bg-white, bg-gray-50
bg-muted | Seções alternadas, hover states | bg-gray-100, bg-gray-200
text-foreground | Texto principal | text-black, text-gray-900
text-muted-foreground | Texto secundário, labels | text-gray-500, text-gray-600
border-border | Bordas de cards, inputs | border-gray-200, border-gray-300
bg-destructive | Erros, remover, alertas críticas | bg-red-500, bg-red-600
bg-success | Sucesso, concluído, positivo | bg-green-500

## §2. DARK MODE — Variáveis obrigatórias

// SEMPRE use estas variáveis, nunca cores hardcoded
bg-background        → Fundo da aplicação
bg-card              → Superfícies elevadas (cards, modais)
bg-muted             → Seções alternadas
text-foreground      → Texto principal
text-muted-foreground → Texto secundário
border-border        → Todas as bordas

// NUNCA use em código novo
bg-white             ❌ → use bg-card ou bg-background
text-black           ❌ → use text-foreground
text-gray-500        ❌ → use text-muted-foreground
border-gray-200      ❌ → use border-border

## §4. TABELAS — Componente Table do shadcn

- SEMPRE use Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- NUNCA crie tabela com div ou HTML nativo
- §34: SEMPRE align-middle em TableRow e TableCell
- §34: Coluna telefone = w-[155px] min-w-[155px] + whitespace-nowrap
- §34: Desktop = botões inline, Mobile = DropdownMenu

## §5. GRÁFICOS — Recharts com tokens CSS

- SEMPRE use "hsl(var(--primary))" para cores, nunca #hex ou tailwind colors
- SEMPRE inclua CustomTooltip padronizado
- SEMPRE use ResponsiveContainer com height fixo (200-300px)

## §6. APROVEITAMENTO DE TELA

- NUNCA max-w-4xl, max-w-7xl, container mx-auto em páginas admin
- SEMPRE w-full, flex-1, min-w-0 em conteúdo principal
- Permitido em: modais, landing pages, páginas públicas

## §7. ANIMAÇÕES — Framer Motion

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) =&gt; ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

## §13. INPUTS — Componentes obrigatórios existentes

CPF/CNPJ     → CpfCnpjInput de @/components/shared/CpfCnpjInput
Endereço+CEP → AddressFields de @/components/shared/AddressFields
Telefone     → PhoneInput de @/components/ui-kit/inputs/PhoneInput
Data         → DateInput de @/components/ui-kit/inputs/DateInput
Moeda        → CurrencyInput de @/components/ui-kit/inputs/CurrencyInput
Unidade      → UnitInput de @/components/ui-kit/inputs/UnitInput

## §16. QUERIES — Só em hooks, nunca em componentes

// ❌ PROIBIDO em componentes
const [data, setData] = useState();
useEffect(() =&gt; {
  supabase.from('tabela').select().then(({ data }) =&gt; setData(data));
}, []);

// ✅ OBRIGATÓRIO — hook separado
const { data, isLoading } = useDados(tenantId); // staleTime incluído

## §17. SERVIÇOS — Lógica de negócio

- Regras de negócio em src/services/, nunca em componentes
- Integrações com APIs externas em services/
- Transformação de dados em services/

## §19. FORMATADORES — Use utilitários existentes

formatBRL        → R$ 1.234,56
formatBRLCompact → R$ 1,2k (para espaços pequenos)
formatKwh        → 1.234 kWh
formatPercent    → 12,5%
formatDateBR     → 15/03/2026
formatPhoneBR    → (11) 98765-4321

## §20. PRINCÍPIOS — SRP, DRY, SSOT, KISS, YAGNI

- Separar UI de lógica de negócio
- Antes de modificar: auditar, entender, preservar, alterar mínimo
- Preferir patches incrementais a rewrites

## §21. APROVEITAMENTO — Largura 100% em admin

// ❌ PROIBIDO
max-w-3xl, max-w-4xl, max-w-5xl, max-w-6xl, max-w-7xl
max-w-screen-lg, max-w-screen-xl
container, container mx-auto

// ✅ OBRIGATÓRIO
w-full, flex-1, min-w-0, p-4 md:p-6

## §22. BOTÕES — Variantes por hierarquia

Ação principal (Novo, Salvar, Confirmar):
  variant="default" → sólido primário (bg-primary)

Ação secundária (Filtrar, Exportar):
  variant="outline"

Destrutiva (Excluir, Remover):
  variant="outline" className="border-destructive text-destructive hover:bg-destructive/10"

Cancelar/Fechar:
  variant="ghost"

## §23. STALETIME — Obrigatório em toda useQuery

Dados em tempo real (chat, notificações): 1000 * 30 (30s)
Dados normais (listas, formulários):      1000 * 60 * 5 (5min)
Dados estáticos (configurações):           1000 * 60 * 15 (15min)

## §25. MODAIS — Tamanhos e estrutura

Simples (4 campos):     w-[90vw] max-w-md
Médio (8 campos):       w-[90vw] max-w-xl
2 colunas/seções:       w-[90vw] max-w-2xl
Endereço completo:      w-[90vw] max-w-3xl
Wizard multi-step:      w-[90vw] max-w-[1100px]

Estrutura obrigatória:
1. DialogHeader com ícone bg-primary/10 + título + subtítulo
2. Corpo com flex-1 min-h-0 overflow-y-auto (scroll interno)
3. Footer com bg-muted/30 e botões alinhados à direita

## §26. HEADER DE PÁGINA — Ícone + título + subtítulo

&lt;div className="flex items-center justify-between mb-6"&gt;
  &lt;div className="flex items-center gap-3"&gt;
    &lt;div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary"&gt;
      &lt;Icon className="w-5 h-5" /&gt;
    &lt;/div&gt;
    &lt;div&gt;
      &lt;h1 className="text-xl font-bold text-foreground"&gt;Título&lt;/h1&gt;
      &lt;p className="text-sm text-muted-foreground"&gt;Subtítulo&lt;/p&gt;
    &lt;/div&gt;
  &lt;/div&gt;
  &lt;div className="flex items-center gap-2"&gt;
    &lt;Button variant="outline" size="sm"&gt;Ação&lt;/Button&gt;
  &lt;/div&gt;
&lt;/div&gt;

## §27. KPI CARDS — Padrão único

&lt;Card className="border-l-[3px] border-l-primary bg-card shadow-sm"&gt;
  &lt;CardContent className="flex items-center gap-4 p-5"&gt;
    &lt;div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0"&gt;
      &lt;Icon className="w-5 h-5" /&gt;
    &lt;/div&gt;
    &lt;div&gt;
      &lt;p className="text-2xl font-bold tracking-tight text-foreground leading-none"&gt;R$ 0,00&lt;/p&gt;
      &lt;p className="text-sm text-muted-foreground mt-1"&gt;Label&lt;/p&gt;
    &lt;/div&gt;
  &lt;/CardContent&gt;
&lt;/Card&gt;

## §28. SWITCHES — bg-primary quando checked

- Verificar src/components/ui/switch.tsx
- SEMPRE bg-primary, nunca blue-600 ou outra cor hardcoded

## §29. ABAS — Header antes de TabsList

Ordem obrigatória:
1. Header da página (§26)
2. TabsList horizontal
3. TabsContent

NUNCA inverta: TabsList antes do título da página.

## §30. MENU — 15 seções (SSOT em navRegistry.ts)

INTEGRAÇÕES = conexão externa (API, OAuth, webhook)
ATENDIMENTO = usar funcionalidades (inbox, filas)
CLIENTES = dados do cliente (cadastro, docs)
OPERAÇÕES = execução (instaladores, estoque, checklists)
ENERGIA = usar dados de energia (monitoramento, tarifas)

## §31. CHANGELOG — Obrigatório para mudanças funcionais

Arquivo: src/data/changelog.ts
Inserir no topo (mais recente primeiro)
Tipos: feature, improvement, bugfix, security, infra

## §32. RESPONSIVIDADE — Mobile-first

Grids: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
Flex: flex-wrap para containers com múltiplos itens
Texto: NUNCA truncar sem tooltip em mobile
Botões: min-h-[44px] em mobile (touch target)
Tabelas: overflow-x-auto no container pai

## §33. PROPOSTA — Sanitização obrigatória

- SEMPRE sanitizeSnapshot() antes de salvar
- SEMPRE whitelist de campos UC, nunca spread ...rest
- SEMPRE headers: { "x-client-timeout": "120" } em edge functions

## §34. TABELA DE LEADS — Alinhamento e colunas

- SEMPRE align-middle em TableRow e TableCell
- Coluna telefone: w-[155px] min-w-[155px] + whitespace-nowrap
- Desktop (lg+): botões inline com Tooltip
- Mobile (&lt;lg): DropdownMenu com MoreHorizontal

## §36. SCROLL INTERNO — min-h-0 obrigatório

// Padrão universal
&lt;div className="flex flex-col h-full overflow-hidden"&gt;
  &lt;div className="shrink-0"&gt;{/* header */}&lt;/div&gt;
  &lt;div className="flex-1 min-h-0 overflow-y-auto"&gt;{/* conteúdo */}&lt;/div&gt;
  &lt;div className="shrink-0"&gt;{/* footer */}&lt;/div&gt;
&lt;/div&gt;

## §37. STORAGE — Signed URL obrigatória

// ❌ PROIBIDO
&lt;img src={`${supabaseUrl}/storage/v1/object/public/${path}`} /&gt;

// ✅ OBRIGATÓRIO
const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
&lt;img src={data.signedUrl} /&gt;

## §38. CONVERSÃO LEAD→VENDA — Fallback de dados

Cadeia de fallback (ordem):
1. Simulação selecionada (potencia_kwp, valor_total)
2. Última proposta nativa (proposta_versoes)
3. Dados do lead (potencia_estimada, valor_projeto)
4. Zero (nunca null)

## §39. WHATSAPP INBOX — Scroll por coluna

- NUNCA scroll global na página
- Cada coluna (lista + chat) é container independente
- Cada um com: flex-col h-full overflow-hidden + flex-1 min-h-0 overflow-y-auto

## §40. DIALOGS ANINHADOS — Transição sequencial

NUNCA: Dialog dentro de Dialog (mobile quebra)
SEMPRE: Fechar pai → delay 150ms → abrir filho
Renderizar filho FORA do pai (mesmo nível de fragment)

## §41. AVATAR — Extração robusta de múltiplas chaves

function extractProfilePictureUrl(payload: any): string | null {
  const candidates = [
    payload?.profilePictureUrl,
    payload?.imgUrl,
    payload?.profilePicUrl,
    payload?.data?.profilePictureUrl,
    // ... etc
  ];
  // Filtrar vazios, "none", "null", "undefined"
  // Retornar primeira URL válida
}

## §43. CRON JOBS — Padrão obrigatório

1. Edge function dedicada
2. Cron job pg_cron + pg_net
3. Última sincronização registrada (last_sync_at)
4. Status visível na UI
5. Botão de sincronização manual
6. Registro de erros (nunca falha silenciosa)

## §44. GOVERNANÇA — SRP, separação UI/lógica

- UI = apresentação, interação, composição
- Hooks/Services = regras de negócio, transformação, integrações
- Separar para testabilidade e manutenção

# =============================================================================
# BLOCO 7 — VALIDAÇÃO AUTOMÁTICA (SCRIPT PRE-BUILD)
# =============================================================================

# Salve como: scripts/validate-agents.js
# Adicione ao package.json: "prebuild": "node scripts/validate-agents.js"

const fs = require('fs');
const glob = require('glob');

const violations = [];
const files = glob.sync('src/**/*.{tsx,ts}');

// RB-01: Cores hardcoded
const colorRegex = /(orange-|blue-|green-|red-|yellow-)[0-9]+|#[0-9a-fA-F]{3,6}/;
files.forEach(file =&gt; {
  const content = fs.readFileSync(file, 'utf8');
  if (colorRegex.test(content) && !file.includes('node_modules')) {
    // Ignorar comentários e strings que possam conter cores
    const lines = content.split('\n');
    lines.forEach((line, idx) =&gt; {
      if (colorRegex.test(line) && !line.includes('//') && !line.includes('*')) {
        violations.push(`[RB-01] Cor hardcoded em ${file}:${idx+1}`);
      }
    });
  }
});

// RB-03: Botão nativo
const buttonRegex = /&lt;button[&gt;\s]/;
files.forEach(file =&gt; {
  if (file.includes('.tsx') && !file.includes('node_modules')) {
    const content = fs.readFileSync(file, 'utf8');
    if (buttonRegex.test(content)) {
      violations.push(`[RB-03] &lt;button&gt; nativo em ${file}`);
    }
  }
});

// RB-05: Query sem staleTime
const queryRegex = /useQuery\(\{[^}]+queryFn:[^}]+staleTime:/s;
files.forEach(file =&gt; {
  if (file.includes('hooks/') && file.endsWith('.ts')) {
    const content = fs.readFileSync(file, 'utf8');
    const queries = content.match(/useQuery\([^)]+\)/g) || [];
    queries.forEach(query =&gt; {
      if (!query.includes('staleTime')) {
        violations.push(`[RB-05] Query sem staleTime em ${file}`);
      }
    });
  }
});

// RB-07: Modal sem w-[90vw]
const modalRegex = /DialogContent[^&gt;]*max-w-/;
files.forEach(file =&gt; {
  if (file.includes('.tsx')) {
    const content = fs.readFileSync(file, 'utf8');
    const modals = content.match(/DialogContent[^&gt;]*&gt;/g) || [];
    modals.forEach(modal =&gt; {
      if (modal.includes('max-w-') && !modal.includes('w-[90vw]')) {
        violations.push(`[RB-07] Modal sem w-[90vw] em ${file}`);
      }
    });
  }
});

// AP-01: Query no componente
const queryInComponent = /useEffect[^}]*supabase\.from/s;
files.forEach(file =&gt; {
  if (file.includes('components/') && file.endsWith('.tsx')) {
    const content = fs.readFileSync(file, 'utf8');
    if (queryInComponent.test(content)) {
      violations.push(`[AP-01] Query direta no componente em ${file}`);
    }
  }
});

// Resultado
if (violations.length &gt; 0) {
  console.error('\n❌ VIOLAÇÕES DO AGENTS.md v2.0:');
  console.error('═══════════════════════════════════════');
  violations.forEach(v =&gt; console.error('  • ' + v));
  console.error(`\nTotal: ${violations.length} violações`);
  console.error('Build cancelado. Corrija antes de continuar.\n');
  process.exit(1);
} else {
  console.log('✅ AGENTS.md v2.0 validado com sucesso');
  console.log(`   ${files.length} arquivos verificados`);
  console.log('   Nenhuma violação encontrada\n');
}

# =============================================================================
# BLOCO 8 — CONVENÇÕES DE NOMENCLATURA
# =============================================================================

Idioma        | Onde usar                     | Exemplo
--------------|-------------------------------|--------------------------------
PT-BR         | Labels de UI, textos, domínio | "Consultor", "Lead", "Proposta"
EN            | Componentes React             | VendorDashboardView.tsx
EN            | Hooks                         | useLeads.ts, useCepLookup.ts
EN            | Utilitários                   | formatBRL.ts, cn.ts
EN            | Tipos TypeScript              | interface Lead { ... }
kebab-case    | Nav keys (navRegistry.ts)     | "gestao-clientes", "pipeline-kanban"
kebab-case    | Edge Functions                | "proposal-generate", "send-wa-message"
snake_case    | Tabelas Supabase              | consultor_metas, checklists_instalador

# =============================================================================
# BLOCO 9 — CHECKLIST FINAL ANTES DE COMMITAR
# =============================================================================

[ ] Build passa: npm run build (zero erros)
[ ] Lint passa: npm run lint (zero warnings de regras do projeto)
[ ] Testes passam: npm run test (se houver)
[ ] Validação AGENTS: npm run prebuild (ou node scripts/validate-agents.js)
[ ] Cores: Nenhum orange-*, blue-*, #hex em componentes novos
[ ] Dark mode: Testei em modo escuro, não quebrou
[ ] Responsive: Testei em 320px e 1920px
[ ] Queries: Estão em hooks com staleTime
[ ] Botões: Todos são &lt;Button&gt; do shadcn
[ ] Modais: Têm w-[90vw] e min-h-0 no corpo
[ ] Changelog: Atualizado se mudança funcional (§31)

# =============================================================================
# BLOCO 10 — REGRESSÕES CONHECIDAS — NUNCA QUEBRAR
# =============================================================================

### WhatsApp / process-webhook-events
- A lógica de `extractMessageContent` já trata ephemeralMessage, audioMessage, documentMessage, imageMessage — NÃO alterar sem rodar testes
- O unwrap de `ephemeralMessage.message` foi adicionado intencionalmente — manter
- Nunca remover o fallback `msg.message || {}`

### AuthForm / handleSignIn
- A função `handleSignIn` DEVE ter sua declaração `const handleSignIn = async (data: LoginData) => {` — nunca remover ou mover para fora do escopo

### Edge Functions — deploy obrigatório
- Após qualquer alteração em `supabase/functions/_shared/*.ts`, SEMPRE fazer redeploy de:
  - `template-preview`
  - `generate-proposal`
  - `docx-to-pdf`
- Nunca alterar shared sem redeployar

### Snapshot camelCase — NUNCA assumir snake_case
- O snapshot do wizard usa camelCase: `pagamentoOpcoes`, `locTipoTelhado`, `locCidade`, `locEstado`, `locIrradiacao`, `locDistribuidoraNome`, `potenciaKwp`
- Sempre usar fallback duplo: `snapshot.pagamentoOpcoes ?? snapshot.pagamento_opcoes`
- Nunca remover fallbacks de camelCase já implementados

### Resolvers de proposta — ordem de fallback
- Nunca simplificar chains de fallback em resolveEntrada, resolvePagamento, resolveSistemaSolar, resolveFinanceiro
- A ordem de prioridade foi definida por auditoria de dados reais — é intencional

### Resolvers de proposta — implementação paralela obrigatória (AP-15)
- O sistema tem DOIS resolvers de variáveis que devem estar sempre sincronizados:
  - FRONTEND: `src/lib/resolveProposalVariables.ts` — usado no preview e auditoria
  - BACKEND:  `supabase/functions/_shared/resolvers/` — usado na geração do PDF final
- NUNCA adicionar variável em apenas um lado
- Ao criar variável nova: implementar nos dois → redeploy das edge functions → testar preview E PDF
- Variáveis comerciais disponíveis no contexto: `ctx.comercial.representante_nome`,
  `representante_email`, `representante_celular`, `responsavel_email`, `responsavel_celular`

### Campos de kit — nomes corretos (AP-16)
- Na tabela `kit_itens` e no objeto de módulo/inversor, o campo de potência é `potencia_w`
- NUNCA usar `modulo.potencia` ou `inversor.potencia` — o campo não existe e retorna undefined
- Sempre usar: `modulo?.potencia_w`, `inversor?.potencia_w`

### usePaybackEngine — queries migradas para useQuery
- As queries de `payback_config` e `fio_b_escalonamento` usam useQuery com staleTime 15min
- NÃO reverter para useState+useEffect — causava refetch a cada troca de step no wizard
- A query de `config_tributaria_estado` e `concessionarias` permanece sob demanda (loadTributaria)
  pois depende de parâmetros dinâmicos (estado, concessionariaId) — isso é intencional

### Itens inativos — feedback visual obrigatório
- Cards e linhas de tabela com ativo=false DEVEM ter opacity-50 + grayscale (cards) ou opacity-50 (tabelas)
- Nunca renderizar item inativo com aparência idêntica ao ativo
- Badge "Inativo" deve estar sempre visível no card (não depender do toggle)
- Regra se aplica a: ModuloCard, InversorCard (inline), OtimizadorCard (inline) e todos os TableViews

### Build — verificação obrigatória
- Após qualquer alteração em componentes React, verificar se não há funções sem declaração
- Nunca fechar um bloco de função prematuramente
- Após correção de bug, rodar `npm run build` e confirmar 0 erros antes de concluir

### Modais de visualização — layout 2 colunas obrigatório
- ViewModals de equipamentos DEVEM usar w-[90vw] max-w-4xl
- Em md+: flex-row com 2 colunas (md:w-1/2 cada)
- Em mobile: flex-col (coluna única)
- Nunca usar max-w-2xl em ViewModal de equipamento — desperdiça espaço em desktop
- max-h-[80vh] com overflow-y-auto no corpo para não ultrapassar a tela

# =============================================================================
# BLOCO 11 — REGRAS DE ESCOPO
# =============================================================================

- Quando a tarefa diz "only touch X", NÃO tocar em nenhum outro arquivo, mesmo que pareça relacionado
- Se encontrar outro bug durante uma tarefa cirúrgica, REPORTAR mas não corrigir — abrir como item separado
- Nunca "aproveitar" para refatorar código adjacente

# =============================================================================
# FIM DO AGENTS.md v2.4
# =============================================================================