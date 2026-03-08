# AGENTS.md — Mais Energia Solar CRM
# Padrões obrigatórios para toda tela nova ou editada

---

## 1. IDENTIDADE VISUAL — nunca quebre isso

Stack: React 18 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Recharts
Fontes: `Inter` (corpo) e `Plus Jakarta Sans` (títulos/display)
Paleta: Solar Orange `hsl(var(--primary))` + Structural Blue `hsl(var(--secondary))`
Design: moderno, denso, sem espaço desperdiçado, dark-mode first quando possível

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
