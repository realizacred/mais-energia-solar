# AGENTS.md — Mais Energia Solar CRM
# Padrões obrigatórios para toda tela nova ou editada

---

## 1. IDENTIDADE VISUAL — nunca quebre isso

### ⚠️ SISTEMA SAAS MULTI-TENANT
Cada empresa cliente configura sua própria identidade visual em `/admin/site-config`.
Cor primária, logo e nome variam por tenant. Nunca assuma uma cor específica como "a cor do sistema".

### REGRA ABSOLUTA — NUNCA hardcode cores
NUNCA use: `orange-*`, `blue-*`, `#FF6600`, `#3b82f6`, `text-orange-500`, `bg-blue-600` ou qualquer cor fixa como identidade visual.

SEMPRE use variáveis semânticas:
- `bg-primary` / `text-primary` / `border-primary` — ação principal, CTAs
- `bg-primary/10` — fundo suave para ícones e badges
- `bg-secondary` / `text-secondary` — elementos secundários
- `bg-card`, `bg-background`, `border-border` — superfícies
- `text-foreground`, `text-muted-foreground` — textos
- `bg-success`, `bg-warning`, `bg-destructive`, `bg-info` — estados semânticos

### Stack
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Framer Motion, Recharts, Supabase

### Fontes
- Interface: `Inter` (corpo) + `Plus Jakarta Sans` (títulos/display)
- Código: `JetBrains Mono`

### Design
Moderno, denso, sem espaço desperdiçado, dark-mode first quando possível.

---

## 2. DARK MODE

O projeto tem dark mode configurado. Toda tela nova deve suportar os dois modos.

```
// SEMPRE use variáveis semânticas, nunca cores hardcoded
bg-background        text-foreground
bg-card              text-card-foreground
bg-muted             text-muted-foreground
border-border

// Para elementos com hover
hover:bg-accent      hover:text-accent-foreground

// NUNCA use
bg-white             → use bg-card ou bg-background
text-black           → use text-foreground
text-gray-500        → use text-muted-foreground
border-gray-200      → use border-border
```

### Slider
- Trilha ativa: SEMPRE `bg-primary`
- NUNCA usar `blue-*`, `#3b82f6` ou qualquer cor hardcoded em sliders
- Verificar override no componente Slider do shadcn (`src/components/ui/slider.tsx`)

### Seções dentro de modais
- NUNCA usar fundo colorido hardcoded para separar seções dentro de modais
- SEMPRE usar: `bg-muted/30 border border-border rounded-lg`
- Exemplos proibidos: `bg-orange-50`, `bg-blue-50`, `bg-amber-*`, `bg-green-50`

---

## 3. CARDS — padrão obrigatório

### KPI Card (número de destaque)
```tsx
<Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
  <CardContent className="flex items-center gap-4 p-5">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">R$ 124.500</p>
      <p className="text-sm text-muted-foreground mt-1">Receita do mês</p>
      <p className="text-xs text-success mt-1 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> +12% vs mês anterior
      </p>
    </div>
  </CardContent>
</Card>
```

### Card de seção com header
```tsx
<Card className="bg-card border-border shadow-sm">
  <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
    <div>
      <CardTitle className="text-base font-semibold text-foreground">Título</CardTitle>
      <p className="text-sm text-muted-foreground mt-0.5">Subtítulo ou descrição</p>
    </div>
    <Button variant="outline" size="sm">Ação</Button>
  </CardHeader>
  <CardContent className="pt-4">
    {/* conteúdo */}
  </CardContent>
</Card>
```

### Card de status / item de lista
```tsx
<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">Nome</p>
      <p className="text-xs text-muted-foreground">Detalhe</p>
    </div>
  </div>
  <Badge variant="outline">Status</Badge>
</div>
```

### Badge de preço/métrica (ex: R$ X,XX / Wp)
```tsx
<Badge variant="outline" className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
  R$ 2,80 / Wp
</Badge>
```
NUNCA usar cor hardcoded em badges de preço/métrica.

### Badge de seção/categoria (ex: KITS SELECIONADOS)
```tsx
<Badge variant="outline" className="border-primary text-primary gap-2">
  <Icon className="w-3.5 h-3.5" /> KITS SELECIONADOS
</Badge>
```
SEMPRE usar `variant="outline"` com `border-primary text-primary`.

---

## 4. TABELAS — padrão obrigatório

Sempre usar o componente Table do shadcn. Nunca criar tabela com div ou HTML nativo.

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

<div className="rounded-lg border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableHead className="font-semibold text-foreground w-[200px]">Cliente</TableHead>
        <TableHead className="font-semibold text-foreground">Status</TableHead>
        <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
        <TableHead className="w-[60px]" />
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow
          key={item.id}
          className="hover:bg-muted/30 cursor-pointer transition-colors"
          onClick={() => handleOpen(item)}
        >
          <TableCell className="font-medium text-foreground">{item.nome}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs">
              {item.status}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatBRLCompact(item.valor)}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Estado vazio de tabela
```tsx
{items.length === 0 && (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon className="w-10 h-10 text-muted-foreground/40 mb-3" />
    <p className="text-sm font-medium text-muted-foreground">Nenhum item encontrado</p>
    <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou adicione um novo</p>
  </div>
)}
```

---

## 5. GRÁFICOS — padrão Recharts

Sempre usar as variáveis CSS da paleta. Nunca cores hardcoded.

```tsx
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
]

// Tooltip customizado — sempre usar este padrão
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Area chart (uso principal — tendências e receita)
<ResponsiveContainer width="100%" height={220}>
  <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
    <Tooltip content={<CustomTooltip />} />
    <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" fill="url(#grad)" strokeWidth={2} dot={false} />
  </AreaChart>
</ResponsiveContainer>

// Bar chart
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
  </BarChart>
</ResponsiveContainer>
```

---

## 6. APROVEITAMENTO DE TELA — regras de layout

```
// Painéis de conteúdo — padding padrão
p-4 md:p-6          (nunca p-8 ou mais em telas de lista)

// Grids de cards KPI
grid-cols-2 md:grid-cols-4 gap-4

// Grids de seções
grid-cols-1 lg:grid-cols-3 gap-4

// Grids de formulários
grid-cols-1 sm:grid-cols-2 gap-4

// Nunca limitar largura do painel
max-w-4xl, max-w-3xl   → PROIBIDO fora de modais/dialogs
container mx-auto      → PROIBIDO em páginas admin

// Header de página padrão
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-xl font-bold text-foreground">Título da Página</h1>
    <p className="text-sm text-muted-foreground mt-0.5">Subtítulo</p>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm">Filtros</Button>
    <Button size="sm">+ Novo</Button>
  </div>
</div>
```

---

## 7. ANIMAÇÕES — Framer Motion

O projeto usa framer-motion. Sempre animar entradas de cards e listas.

```tsx
import { motion } from "framer-motion"

// Entrada de cards em grid — stagger
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
}

{items.map((item, i) => (
  <motion.div key={item.id} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
    {/* card */}
  </motion.div>
))}

// Entrada de página
<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
  {/* conteúdo da página */}
</motion.div>

// Hover em item interativo
<motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.15 }}>
```

---

## 8. BADGES E STATUS

```tsx
// Status de projeto/lead
const statusConfig = {
  ativo:      { label: "Ativo",      className: "bg-success/10 text-success border-success/20" },
  pendente:   { label: "Pendente",   className: "bg-warning/10 text-warning border-warning/20" },
  cancelado:  { label: "Cancelado",  className: "bg-destructive/10 text-destructive border-destructive/20" },
  concluido:  { label: "Concluído",  className: "bg-info/10 text-info border-info/20" },
}

<Badge variant="outline" className={`text-xs ${statusConfig[status].className}`}>
  {statusConfig[status].label}
</Badge>
```

---

## 9. KANBAN CARDS

```tsx
// Card do pipeline — denso, com todas as infos visíveis
<div className={cn(
  "group relative bg-card border border-border rounded-lg p-3 shadow-sm",
  "hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer",
  isDragging && "opacity-50 rotate-1 shadow-lg"
)}>
  {/* topo: código + badge urgência */}
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs font-mono text-muted-foreground">{lead.lead_code}</span>
    {isUrgente && <Badge className="text-[10px] h-4 bg-destructive/10 text-destructive border-destructive/20">Urgente</Badge>}
  </div>

  {/* nome */}
  <p className="text-sm font-semibold text-foreground truncate mb-1">{lead.nome}</p>

  {/* infos compactas */}
  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.cidade}/{lead.estado}</span>
    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{lead.media_consumo} kWh</span>
  </div>

  {/* rodapé: valor + consultor + tempo */}
  <div className="flex items-center justify-between">
    <span className="text-xs font-semibold text-primary">{formatBRLCompact(lead.valor_projeto)}</span>
    <span className="text-xs text-muted-foreground">{diasAtras}d atrás</span>
  </div>
</div>
```

---

## 10. PLANILHAS E GRIDS DENSOS (relatórios financeiros)

```tsx
// Para telas de planilha tipo Excel — usar tabela densa
<div className="rounded-lg border border-border overflow-auto">
  <Table>
    <TableHeader className="sticky top-0 z-10">
      <TableRow className="bg-muted hover:bg-muted">
        <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-9 px-3">Col</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id} className="h-9 hover:bg-muted/40 transition-colors">
          <TableCell className="px-3 py-1 text-sm">{row.valor}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>

// Linha de totais no rodapé
<div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-t border-border rounded-b-lg">
  <span className="text-sm font-semibold text-foreground">Total</span>
  <span className="text-sm font-bold text-primary">{formatBRL(total)}</span>
</div>
```

---

## 11. MODAIS E DRAWERS

```tsx
// Dialog padrão
<Dialog>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-lg">
        <Icon className="w-5 h-5 text-primary" />
        Título do Modal
      </DialogTitle>
      <DialogDescription>Descrição breve</DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      {/* conteúdo */}
    </div>
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Sheet (drawer lateral — para detalhes)
<Sheet>
  <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
    <SheetHeader className="border-b border-border pb-4 mb-4">
      <SheetTitle>Título</SheetTitle>
    </SheetHeader>
    {/* conteúdo */}
  </SheetContent>
</Sheet>
```

---

## 12. LOADING STATES

Toda tela com dados async deve ter skeleton. Nunca deixar em branco.

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Skeleton de card KPI
{loading ? (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i} className="p-5">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </Card>
    ))}
  </div>
) : (
  // cards reais
)}

// Skeleton de tabela
{loading ? (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
) : (
  // tabela real
)}
```

---

## 13. INPUTS — componentes obrigatórios

Não criar campos do zero. Usar sempre:

```
CPF / CNPJ     → import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput"
Endereço+CEP   → import { AddressFields } from "@/components/shared/AddressFields"
Busca de CEP   → import { useCepLookup } from "@/hooks/useCepLookup"
Telefone       → import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput"
Data           → import { DateInput } from "@/components/ui-kit/inputs/DateInput"
Valor R$       → import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput"
Unidade        → import { UnitInput } from "@/components/ui-kit/inputs/UnitInput"
Botões         → import { Button } from "@/components/ui/button"
```

---

## 14. BANCO DE DADOS — regras críticas

- Nunca reescrever queries ao fazer ajuste visual
- Nunca remover campos sem verificar se são salvos no banco
- Sempre usar os tipos de `@/integrations/supabase/types`
- RLS já configurado — não adicionar lógica de permissão no frontend
- Para novas queries: sempre usar o hook existente ou criar um novo em `src/hooks/`
- Nomes de tabelas: ver `src/integrations/supabase/types.ts` (323 tabelas mapeadas)

---

## 15. ESTRUTURA DE PASTAS

```
src/
  components/
    shared/           ← componentes reutilizáveis (CEP, CPF, Endereço)
    ui/               ← shadcn/ui — NÃO modificar
    ui-kit/inputs/    ← inputs customizados — usar sempre
    admin/            ← telas do painel admin
    vendor/           ← portal do consultor
  hooks/              ← verificar antes de criar novo hook
  pages/              ← rotas principais
  lib/                ← utilitários (cpfCnpjUtils, formatters, etc)
  services/           ← lógica de integrações e monitoring
```

---

## 16. QUERIES — padrão obrigatório

Nunca fazer query Supabase diretamente em componentes React.
Queries devem ficar em `src/hooks/`.
Componentes devem apenas consumir hooks.

---

## 17. SERVIÇOS

Lógica de negócio nunca deve ficar no componente.
Deve ficar em `src/services/`.

Responsabilidades:
- integração com APIs
- cálculos de negócio
- transformação de dados
- comunicação com providers externos

---

## 18. SAFE QUERY PATTERNS

Sempre que aplicável:
- respeitar tenant isolation
- evitar selects desnecessários
- não quebrar RLS
- não retornar dados excessivos

---

## 19. FORMATADORES

Nunca formatar valores manualmente. Usar utilitários em `src/lib/formatters`:

```
formatBRL        formatKwh
formatPercent    formatDateBR
formatBRLCompact
```

---

## 20. PRINCÍPIOS DE ENGENHARIA

Seguir sempre: SRP, DRY, SSOT, KISS, YAGNI, SOLID quando aplicável.

Separar UI de lógica de negócio.

Antes de modificar código:
1. auditar o estado atual
2. entender como já funciona
3. preservar o que está correto
4. alterar apenas o necessário
5. preferir patches incrementais

---

## 21. APROVEITAMENTO DE TELA — REGRA GLOBAL

O sistema deve utilizar **100% da largura disponível** do painel administrativo.

É PROIBIDO em páginas admin:
```
max-w-3xl / max-w-4xl / max-w-5xl / max-w-6xl / max-w-7xl
max-w-screen-lg / max-w-screen-xl
container / container mx-auto
```

Permitido apenas em: modais, dialogs, drawers, páginas públicas, landing pages.

Usar sempre no conteúdo principal:
```
w-full    flex-1    min-w-0    p-4 md:p-6
```

---

## 22. PADRÃO DE BOTÕES — Regra obrigatória

- Ação principal (+ Novo, + Criar, Salvar, Confirmar): `variant="default"` — SEMPRE sólido laranja
- Ação secundária (Filtrar, Exportar, Atualizar): `variant="outline"`
- Ação destrutiva (Excluir, Remover, Deletar): `variant="destructive"`
- Navegação e fechamento (Voltar, Fechar, Cancelar): `variant="ghost"`
- Ação de sucesso (Aprovar, Concluir, Marcar como pago): `variant="success"`
- Ação de alerta (Pausar, Pendente, Revisar): `variant="warning"`

NUNCA usar `variant="outline"` em botão de ação principal.
NUNCA usar `<button>` HTML nativo — sempre `Button` de `@/components/ui/button`.

### Dois botões no mesmo modal (mesma hierarquia)
Quando há 2 opções de escolha no mesmo nível:
- Primeira opção: `variant="default"` (primário)
- Segunda opção: `variant="outline" className="border-primary text-primary hover:bg-primary/10"`
- NUNCA dois botões `variant="default"` lado a lado

### Botão de remover/deletar
NUNCA usar `bg-destructive` sólido escuro.
SEMPRE usar:
```tsx
<Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
  Remover
</Button>
```

### Botões dentro de cards e fundos coloridos
- Botão dentro de card laranja ou fundo primário: `variant="outline" className="bg-background"`
- Botão de ação rápida dentro de kanban card: `variant="ghost" size="sm"`
- Botão de adicionar item em coluna: `variant="outline" size="sm" className="w-full border-dashed"`
- NUNCA usar `variant="default"` dentro de elemento com fundo laranja/primário

### Toggle de Visualização (Grid/Lista)
- Usar `ToggleGroup` do shadcn/ui
- Item ativo: `bg-primary/10 text-primary border-primary`
- Item inativo: `variant="outline"`
- NUNCA usar `border-orange` ou cores hardcoded
- NUNCA usar `<button>` HTML nativo — sempre componentes do shadcn

### Botão sempre deve ter texto visível
- NUNCA deixar botão sem texto ou ícone visível
- Se condicional, usar `hidden` em vez de render vazio
- Botões apenas com ícone DEVEM ter `aria-label`

---

## 23. staleTime OBRIGATÓRIO em todo useQuery

- Dados de monitoramento em tempo real: `staleTime: 1000 * 30`
- Dados normais (listas, formulários): `staleTime: 1000 * 60 * 5`
- Dados estáticos (configurações, planos, permissões): `staleTime: 1000 * 60 * 15`

NUNCA criar useQuery sem staleTime.

---

## 24. REGRA DE OVERLAYS E FUNDOS

- `bg-black/XX` — permitido apenas em overlays de media player e componentes shadcn nativos
- `bg-white` sólido — permitido apenas em canvas de assinatura (SignaturePad)
- `bg-white/XX` com opacidade — permitido em overlays sobre gradientes e heroes institucionais
- Para todos os outros casos usar `bg-card`, `bg-background` ou `bg-muted`

---

## 25. TAMANHOS DE MODAIS (DialogContent)

- Formulário simples até 4 campos: `max-w-md`
- Formulário médio até 8 campos: `max-w-2xl`
- Formulário com 2 colunas ou seções: `w-[90vw] max-w-[1100px]`
- Formulário completo com endereço e múltiplas seções: `w-[90vw] max-w-[1100px]`
- Wizard multi-step: `w-[90vw] max-w-[1100px]`

REGRA: Sempre usar `w-[90vw]` para aproveitar a tela toda em notebooks e monitores.
NUNCA usar `max-w-2xl` ou `max-w-4xl` em formulários com 2 ou mais colunas.
NUNCA criar scroll interno em modal — todo conteúdo deve estar visível.

---

## 26. PADRÃO DE HEADER DE PÁGINA

Toda página admin deve ter header padronizado. Referência: ComissoesManager.tsx.

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h1 className="text-xl font-bold text-foreground">Título da Página</h1>
      <p className="text-sm text-muted-foreground">Subtítulo descritivo</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm">Exportar</Button>
    <Button size="sm">+ Novo</Button>
  </div>
</div>
```

NUNCA usar ícone cinza no header principal.
SEMPRE ícone com `bg-primary/10 text-primary`.

---

## 27. PADRÃO DE CARDS KPI

Um único padrão para TODOS os cards de número/métrica no sistema:

```tsx
<Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
  <CardContent className="flex items-center gap-4 p-5">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">R$ 0,00</p>
      <p className="text-sm text-muted-foreground mt-1">Label do card</p>
    </div>
  </CardContent>
</Card>
```

PROIBIDO:
- Cards com fundo colorido sólido (laranja, azul, verde)
- Cards com borda inferior colorida
- Cards sem borda lateral esquerda
- Cards com ícone cinza/muted
- Misturar estilos de KPI na mesma tela

---

## 28. SWITCHES E TOGGLES

Todos os switches/toggles do sistema devem seguir:

- Cor ativa: bg-primary (laranja) — NUNCA azul ou hardcoded
- Cor inativa: bg-muted
- Verificar src/components/ui/switch.tsx — deve usar bg-primary quando checked

Containers que envolvem switches devem:
- Ter padding suficiente: px-3 py-2
- NUNCA usar overflow-hidden no elemento pai direto do switch
- Garantir que o switch não seja cortado pela borda do container

---

## 29. PADRÃO DE ABAS INTERNAS

Quando uma página tem menu de abas interno, a ordem obrigatória é:

1. Header da página (ícone + título + subtítulo) — seção 26
2. Menu de abas (TabsList horizontal)
3. Conteúdo da aba ativa

NUNCA colocar TabsList antes do header.
NUNCA colocar o título dentro do conteúdo da aba.

Exemplo correto:
```tsx
<div className="p-4 md:p-6">
  {/* 1. Header sempre primeiro */}
  <div className="flex items-center gap-3 mb-4">
    <div className="w-10 h-10 rounded-lg bg-primary/10 
    text-primary flex items-center justify-center">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <h1 className="text-xl font-bold text-foreground">
        Título
      </h1>
      <p className="text-sm text-muted-foreground">
        Subtítulo
      </p>
    </div>
  </div>

  {/* 2. Abas depois do header */}
  <Tabs defaultValue="dashboard">
    <TabsList>
      <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
      <TabsTrigger value="lista">Lista</TabsTrigger>
    </TabsList>

    {/* 3. Conteúdo */}
    <TabsContent value="dashboard">
      ...
    </TabsContent>
  </Tabs>
</div>
```

Telas que usam esse padrão: Monitoramento Solar, Recebimentos e qualquer tela com TabsList interno.

---

## 30. ESTRUTURA DO MENU — 15 seções

O menu lateral do sistema é organizado em 15 seções. O arquivo `navRegistry.ts` é a Fonte Única de Verdade (SSOT).

1. **PAINEL** — Painel Geral, Performance
2. **COMERCIAL** — Leads, Pipeline, Projetos, Acompanhamentos, Distribuição de Leads, SLA & Breaches, Inteligência Comercial, Aprovações
3. **ATENDIMENTO** — Central WhatsApp, Fila de Follow-ups, Regras de Follow-up, Métricas de Atendimento, Regras de Retorno, Fila de Retorno, Instâncias WhatsApp, Automação WhatsApp, Etiquetas WhatsApp, Respostas Rápidas
4. **CLIENTES** — Gestão de Clientes, Documentação, Avaliações NPS, Agenda de Serviços, Documentos & Assinaturas
5. **PÓS-VENDA** — Dashboard, Preventivas, Planos, Checklists, Oportunidades
6. **OPERAÇÕES** — Instaladores, Estoque, Validação de Vendas, Tarefas & SLA
7. **FINANCEIRO** — Recebimentos, Inadimplência, Comissões, Fiscal, Financiamentos, Premissas Fiscais, Política de Preços
8. **EQUIPE** — Consultores, Gamificação
9. **IA** — Copilot IA, Configuração de IA
10. **ENERGIA** — Unidades Consumidoras, Medidores, Monitoramento Solar, Usinas, Alertas, Relatórios, Integrações Monitoramento, SolarMarket Config, SolarMarket Importação
11. **INTEGRAÇÕES** — Catálogo de Integrações, Saúde das Integrações, Meta Ads Dashboard, Webhooks
12. **SITE** — Conteúdo & Visual, Serviços, Portfólio, Instagram
13. **CADASTROS** — Disjuntores & Transf., Módulos Fotovoltaicos, Inversores, Baterias, Fornecedores, Concessionárias, Dicionário ANEEL, Versões de Tarifa, Saúde Tarifária, Status Sync ANEEL, Premissas, Base Meteorológica
14. **CONFIGURAÇÕES** — Calculadora Solar, Status de Leads, Motivos de Perda, Loading & Mensagens
15. **ADMINISTRAÇÃO** — Empresa, Usuários & Permissões, Permissões por Papel, Auditoria, Notificações, Links & Captação, Google Maps, Release Notes, Atualizações, Personalizar Menus, Limpeza de Dados

---

## 31. CHANGELOG OBRIGATÓRIO

Toda alteração significativa (feature, melhoria, correção, segurança ou infra) **DEVE** gerar uma entrada no arquivo `src/data/changelog.ts`.

Regras:
- Arquivo `src/data/changelog.ts` é a **Fonte Única de Verdade (SSOT)** do histórico de atualizações
- Entradas devem ser inseridas **no topo** do array `CHANGELOG` (mais recente primeiro)
- Cada entrada deve conter: `version` (semver), `date` (YYYY-MM-DD), `title`, `description`, `type` e opcionalmente `details[]`
- Incrementar versão seguindo SemVer: major (breaking), minor (feature/improvement), patch (bugfix)
- O campo `details` deve listar os itens concretos alterados (máximo 5-6 bullets)
- Agrupar múltiplas correções pequenas em uma única entrada quando feitas na mesma sessão

Tipos válidos:
- `feature` — funcionalidade nova
- `improvement` — melhoria em funcionalidade existente
- `bugfix` — correção de bug
- `security` — hardening, RLS, permissões
- `infra` — migrations, edge functions, CI/CD

Exemplo:
```ts
{
  version: "2.15.0",
  date: "2026-03-15",
  title: "Título curto e descritivo",
  type: "feature",
  description: "Uma frase resumindo o que mudou e por quê.",
  details: [
    "Detalhe concreto 1",
    "Detalhe concreto 2",
  ],
}
```

NUNCA esquecer de atualizar o changelog ao finalizar uma implementação significativa.
