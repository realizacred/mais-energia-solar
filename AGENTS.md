# AGENTS.md — Mais Energia Solar CRM

Padrões obrigatórios para toda tela nova ou editada.

---

## 📑 ÍNDICE

- [Bloco 0 — TL;DR Checklist](#bloco-0--tldr-checklist)
- [Bloco 1 — Regras Bloqueantes](#bloco-1--regras-bloqueantes)
- [Bloco 2 — Boas Práticas](#bloco-2--boas-práticas)
- [Bloco 3 — Referência de Padrões (§1–§38)](#bloco-3--referência-de-padrões)
- [Bloco 4 — Conflitos e Exceções Oficiais](#bloco-4--conflitos-e-exceções-oficiais)
- [Bloco 5 — Validação Antes de Finalizar](#bloco-5--validação-antes-de-finalizar)
- [Bloco 6 — Convenções de Nomenclatura](#bloco-6--convenções-de-nomenclatura)
- [Bloco 7 — Escopo por Área](#bloco-7--escopo-por-área)
- [Bloco 8 — WhatsApp / Mobile / Modais / Avatar](#bloco-8--whatsapp--mobile--modais--avatar)

---

# Bloco 0 — TL;DR CHECKLIST

Antes de finalizar **qualquer** tarefa, verifique os 24 itens:

- [ ] Cores: `bg-primary`, `text-primary` (nunca hex, nunca `orange-*`, `blue-*`)
- [ ] Button shadcn (`@/components/ui/button`) — nunca `<button>` nativo
- [ ] `staleTime` em toda `useQuery` (ver §23)
- [ ] Queries só em hooks (`src/hooks/`) — nunca em componente (ver §16)
- [ ] `Skeleton` no loading — nunca spinner solto (ver §12)
- [ ] Responsive: `grid-cols-1 sm:grid-cols-2` (ver §32)
- [ ] Modal: `w-[90vw] max-w-[tamanho]` (ver §25)
- [ ] Header de página **antes** de `TabsList` (ver §29)
- [ ] Changelog atualizado se mudança funcional (ver §31)
- [ ] Não modificar `src/components/ui/` (exceto `switch.tsx` e `slider.tsx`)
- [ ] NUNCA hardcode cor laranja/azul/hex em UI
- [ ] Sanitizar snapshot antes de salvar proposta (ver §33)
- [ ] Whitelist explícita de campos UC (ver §33)
- [ ] `x-client-timeout: "120"` nas edge functions de proposta (ver §33)
- [ ] INTEGRAÇÕES = conexão externa, não funcionalidade (ver §30)
- [ ] Telefone: `PhoneInput` de `@/components/ui-kit/inputs/PhoneInput` — nunca input nativo
- [ ] CPF/CNPJ: `CpfCnpjInput` de `@/components/shared/CpfCnpjInput` — nunca criar do zero
- [ ] Endereço: `AddressFields` de `@/components/shared/AddressFields` — nunca recriar
- [ ] Modal: `DialogHeader` + `DialogTitle` + botões shadcn — nunca `<button>` nativo
- [ ] Formulário: `bg-card` + `text-foreground` — nunca `bg-white`/`gray-*`
- [ ] Verificar `src/components/shared/`, `ui-kit/`, `ui/` antes de criar componente novo
- [ ] Scroll interno: `min-h-0` em todo flex-col com overflow (ver §36)
- [ ] WhatsApp Inbox: scroll por coluna independente — NUNCA scroll global na página (ver §39)
- [ ] Storage paths: resolver com signed URL antes de exibir (ver §37)
- [ ] Conversão lead→venda: fallback de dados técnicos obrigatório (ver §38)

---

---

# Bloco 1 — REGRAS BLOQUEANTES

Se descumprido = bug, inconsistência visual ou erro em produção.

### 🚫 BLOQUEANTE — Cores semânticas obrigatórias
NUNCA use: `orange-*`, `blue-*`, `#FF6600`, `#3b82f6`, `text-orange-500`, `bg-blue-600` ou qualquer cor fixa.
SEMPRE use variáveis semânticas: `bg-primary`, `text-primary`, `bg-card`, `text-foreground`, `bg-success`, etc.
→ Ver §1, §2

### 🚫 BLOQUEANTE — Dark mode em toda tela nova
NUNCA: `bg-white`, `text-black`, `text-gray-500`, `border-gray-200`.
SEMPRE: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`.
→ Ver §2

### 🚫 BLOQUEANTE — Button shadcn obrigatório
NUNCA usar `<button>` HTML nativo. SEMPRE `Button` de `@/components/ui/button`.
→ Ver §22

### 🚫 BLOQUEANTE — staleTime em toda useQuery
Sem staleTime = queries desnecessárias e UX degradada.
→ Ver §23

### 🚫 BLOQUEANTE — Queries só em hooks
NUNCA query Supabase em componente React. Sempre em `src/hooks/`.
→ Ver §16

### 🚫 BLOQUEANTE — Skeleton no loading
NUNCA deixar tela em branco durante loading. Sempre `Skeleton`.
→ Ver §12

### 🚫 BLOQUEANTE — Responsividade obrigatória
Todo componente funciona em 320px–1920px. NUNCA largura fixa em px.
→ Ver §32

### 🚫 BLOQUEANTE — Modal com w-[90vw]
NUNCA usar `max-w-*` sozinho sem `w-[90vw]` em modais com 2+ colunas.
→ Ver §25

### 🚫 BLOQUEANTE — Header antes de TabsList
A ordem é: header → abas → conteúdo. NUNCA inverter.
→ Ver §29

### 🚫 BLOQUEANTE — Aproveitamento de tela (admin)
NUNCA `max-w-*`, `container mx-auto` em páginas admin.
→ Ver §21

### 🚫 BLOQUEANTE — Não modificar src/components/ui/
Exceto `switch.tsx` e `slider.tsx` para tokens semânticos.
→ Ver [Bloco 4](#bloco-4--conflitos-e-exceções-oficiais)

### 🚫 BLOQUEANTE — Proposta: sanitizar + whitelist + timeout
→ Ver §33

### 🚫 BLOQUEANTE — Multi-tenant: nunca assumir cor fixa
Cada tenant configura sua identidade em `/admin/site-config`.
→ Ver §1

### 🚫 BLOQUEANTE — Telefone: NUNCA input nativo
NUNCA usar `<Input>` ou `<input>` para telefone. SEMPRE usar `PhoneInput` de `@/components/ui-kit/inputs/PhoneInput` que já formata `(XX) XXXXX-XXXX` automaticamente.
→ Ver §13

### 🚫 BLOQUEANTE — CPF/CNPJ: NUNCA criar input do zero
SEMPRE usar `CpfCnpjInput` de `@/components/shared/CpfCnpjInput`. Nunca criar máscara manual.
→ Ver §13

### 🚫 BLOQUEANTE — Endereço: NUNCA criar campos do zero
SEMPRE usar `AddressFields` de `@/components/shared/AddressFields` com `useCepLookup`. Nunca recriar CEP/estado/cidade manualmente.
→ Ver §13

### 🚫 BLOQUEANTE — Modal: NUNCA criar sem seguir §25
Todo modal de formulário DEVE ter: `w-[90vw] max-w-[tamanho]`, `DialogHeader` + `DialogTitle` shadcn, botões `variant="outline"` + `variant="default"` (nunca `<button>` nativo), grid `grid-cols-1 sm:grid-cols-2`.
→ Ver §25

### 🚫 BLOQUEANTE — Formulário: NUNCA bg-white
NUNCA usar `bg-white`, `text-black`, `gray-*` em modais ou formulários. SEMPRE `bg-card`, `text-foreground`, `border-border`.
→ Ver §2

### 🚫 BLOQUEANTE — Componentes: verificar antes de criar
Antes de criar QUALQUER componente novo, verificar se já existe em: `src/components/shared/`, `src/components/ui-kit/`, `src/components/ui/`. Nunca duplicar funcionalidade existente.

### 🚫 BLOQUEANTE — Scroll interno: min-h-0 obrigatório
Containers `flex-col` com `flex-1` e scroll interno DEVEM ter `min-h-0`. Sem isso, `overflow-y-auto` não funciona.
→ Ver §36

### 🚫 BLOQUEANTE — WhatsApp Inbox: NUNCA scroll global
A página do inbox NUNCA deve ter scroll global. A coluna de lista de conversas e o painel de chat são containers independentes, cada um com seu próprio scroll (`flex-col h-full overflow-hidden` + `flex-1 min-h-0 overflow-y-auto`).
→ Ver §36, §39

### 🚫 BLOQUEANTE — Storage paths: signed URL obrigatória
NUNCA usar path raw do Supabase Storage como `src` de imagem. SEMPRE resolver com `createSignedUrl`.
→ Ver §37

### 🚫 BLOQUEANTE — Conversão lead→venda: fallback obrigatório
NUNCA criar cliente com `potencia_kwp = null` se existir simulação ou proposta. SEMPRE usar cadeia de fallback.
→ Ver §38

# Bloco 2 — BOAS PRÁTICAS

Recomendado mas não bloqueia PR.

### 💡 RECOMENDADO — Framer Motion em entradas
Animar cards e listas com stagger.
→ Ver §7

### 💡 RECOMENDADO — Tooltip em texto truncado mobile
→ Ver §32

### 💡 RECOMENDADO — Formatadores centralizados
Usar `formatBRL`, `formatKwh`, `formatPercent`, `formatDateBR`, `formatBRLCompact` de `src/lib/formatters`.
→ Ver §19

### 💡 RECOMENDADO — Lógica em services, não em componentes
→ Ver §17

### 💡 RECOMENDADO — Princípios de engenharia
SRP, DRY, SSOT, KISS, YAGNI. Patches incrementais.
→ Ver §20

### 💡 RECOMENDADO — Inputs especializados além dos obrigatórios
Usar também: `CurrencyInput`, `DateInput`, `UnitInput` quando aplicável.
→ Ver §13

### 💡 RECOMENDADO — Safe query patterns
Respeitar tenant isolation, evitar selects desnecessários, não quebrar RLS.
→ Ver §18

---

# Bloco 3 — REFERÊNCIA DE PADRÕES

Todas as seções originais §1–§38, reorganizadas sem duplicações.

---

## §1. IDENTIDADE VISUAL — nunca quebre isso

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

## §2. DARK MODE

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

## §3. CARDS — padrão obrigatório

### KPI Card
→ **Ver §27** (fonte única de verdade para KPI cards)

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

## §4. TABELAS — padrão obrigatório

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

## §5. GRÁFICOS — padrão Recharts

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

## §6. APROVEITAMENTO DE TELA — regras de layout

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

// Header de página padrão → Ver §26
```

---

## §7. ANIMAÇÕES — Framer Motion

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

## §8. BADGES E STATUS

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

## §9. KANBAN CARDS

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

## §10. PLANILHAS E GRIDS DENSOS (relatórios financeiros)

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

## §11. MODAIS E DRAWERS

Para estrutura e tamanhos de modal → **Ver §25** (fonte única de verdade). Não duplicar padrões aqui.

---

## §12. LOADING STATES

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

## §13. INPUTS — componentes obrigatórios

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

## §14. BANCO DE DADOS — regras críticas

- Nunca reescrever queries ao fazer ajuste visual
- Nunca remover campos sem verificar se são salvos no banco
- Sempre usar os tipos de `@/integrations/supabase/types`
- RLS já configurado — não adicionar lógica de permissão no frontend
- Para novas queries: sempre usar o hook existente ou criar um novo em `src/hooks/`
- Nomes de tabelas: ver `src/integrations/supabase/types.ts` (323 tabelas mapeadas)

---

## §15. ESTRUTURA DE PASTAS

```
src/
  components/
    shared/           ← componentes reutilizáveis (CEP, CPF, Endereço)
    ui/               ← shadcn/ui — NÃO modificar (exceto switch.tsx, slider.tsx)
    ui-kit/inputs/    ← inputs customizados — usar sempre
    admin/            ← telas do painel admin
    vendor/           ← portal do consultor
  hooks/              ← verificar antes de criar novo hook
  pages/              ← rotas principais
  lib/                ← utilitários (cpfCnpjUtils, formatters, etc)
  services/           ← lógica de integrações e monitoring
```

---

## §16. QUERIES — padrão obrigatório

Nunca fazer query Supabase diretamente em componentes React.
Queries devem ficar em `src/hooks/`.
Componentes devem apenas consumir hooks.

---

## §17. SERVIÇOS

Lógica de negócio nunca deve ficar no componente.
Deve ficar em `src/services/`.

Responsabilidades:
- integração com APIs
- cálculos de negócio
- transformação de dados
- comunicação com providers externos

---

## §18. SAFE QUERY PATTERNS

Sempre que aplicável:
- respeitar tenant isolation
- evitar selects desnecessários
- não quebrar RLS
- não retornar dados excessivos

---

## §19. FORMATADORES

Nunca formatar valores manualmente. Usar utilitários em `src/lib/formatters`:

```
formatBRL        formatKwh
formatPercent    formatDateBR
formatBRLCompact formatPhoneBR
```

---

## §20. PRINCÍPIOS DE ENGENHARIA

Seguir sempre: SRP, DRY, SSOT, KISS, YAGNI, SOLID quando aplicável.

Separar UI de lógica de negócio.

Antes de modificar código:
1. auditar o estado atual
2. entender como já funciona
3. preservar o que está correto
4. alterar apenas o necessário
5. preferir patches incrementais

---

## §21. APROVEITAMENTO DE TELA — REGRA GLOBAL

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

## §22. PADRÃO DE BOTÕES — Regra obrigatória

- Ação principal (+ Novo, + Criar, Salvar, Confirmar): `variant="default"` — SEMPRE sólido primário (`bg-primary`)
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
- Botão dentro de card com fundo primário: `variant="outline" className="bg-background"`
- Botão de ação rápida dentro de kanban card: `variant="ghost" size="sm"`
- Botão de adicionar item em coluna: `variant="outline" size="sm" className="w-full border-dashed"`
- NUNCA usar `variant="default"` dentro de elemento com fundo primário

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

## §23. staleTime OBRIGATÓRIO em todo useQuery

- Dados de monitoramento em tempo real: `staleTime: 1000 * 30`
- Dados normais (listas, formulários): `staleTime: 1000 * 60 * 5`
- Dados estáticos (configurações, planos, permissões): `staleTime: 1000 * 60 * 15`

NUNCA criar useQuery sem staleTime.

---

## §24. REGRA DE OVERLAYS E FUNDOS

- `bg-black/XX` — permitido apenas em overlays de media player e componentes shadcn nativos
- `bg-white` sólido — permitido apenas em canvas de assinatura (SignaturePad)
- `bg-white/XX` com opacidade — permitido em overlays sobre gradientes e heroes institucionais
- Para todos os outros casos usar `bg-card`, `bg-background` ou `bg-muted`

---

## §25. TAMANHOS E PADRÃO VISUAL DE MODAIS

### Tamanhos (DialogContent):
- Simples até 4 campos: `max-w-md`
- Médio até 8 campos: `w-[90vw] max-w-xl`
- Com 2 colunas ou seções: `w-[90vw] max-w-2xl`
- Completo com endereço: `w-[90vw] max-w-3xl`
- Wizard multi-step: `w-[90vw] max-w-[1100px]`

REGRA: SEMPRE usar `w-[90vw]` para aproveitar a tela em notebooks e monitores.

### Estrutura obrigatória de todo modal:
```tsx
<Dialog>
  <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">

    {/* HEADER com ícone + título + subtítulo */}
    <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1">
        <DialogTitle className="text-base font-semibold text-foreground">
          Título do Modal
        </DialogTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Descrição curta do que fazer aqui
        </p>
      </div>
    </DialogHeader>

    {/* CORPO com seções separadas por divisor — flex-1 min-h-0 para scroll correto */}
    <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto">

      {/* Seção com título */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Dados pessoais
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* campos aqui */}
        </div>
      </div>

      {/* Divisor entre seções */}
      <div className="border-t border-border" />

      {/* Segunda seção */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Endereço
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* campos aqui */}
        </div>
      </div>

    </div>

    {/* FOOTER fixo com ações */}
    <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
      <Button variant="outline" onClick={onClose}>
        Cancelar
      </Button>
      <Button onClick={onSave}>
        Salvar
      </Button>
    </div>

  </DialogContent>
</Dialog>
```

### Regras do novo padrão:
- SEMPRE ícone `bg-primary/10 text-primary` no header
- SEMPRE subtítulo descritivo abaixo do título
- SEMPRE seções separadas por `border-t border-border`
- SEMPRE título de seção em `uppercase text-xs tracking-wide`
- SEMPRE footer com `bg-muted/30` e botões alinhados à direita
- NUNCA scroll na página inteira — usar `flex-1 min-h-0 overflow-y-auto` no corpo (nunca `max-h-[70vh]` — causa dupla restrição, ver §39)
- NUNCA `bg-white` em nenhuma parte do modal
- NUNCA criar modal sem ícone no header

### Layout em 2 colunas (modais com 4+ seções)
Quando um modal tiver 4 ou mais seções de conteúdo (ex: dados do cliente,
dados da proposta, documentos, comissão), usar layout em 2 colunas
para aproveitar a tela e evitar scroll excessivo:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
  {/* Coluna esquerda — dados principais */}
  <div className="p-5 space-y-5">
    {/* seções de dados */}
  </div>
  {/* Coluna direita — ações e detalhes */}
  <div className="p-5 space-y-5">
    {/* seções de ações */}
  </div>
</div>
```

Regras:
- Em mobile (< md): voltar para coluna única automaticamente
- Largura do modal com 2 colunas: `w-[90vw] max-w-[780px]`
- Divisor entre colunas: `divide-x divide-border` (nunca cor hardcoded)
- Coluna esquerda: dados do cliente, dados da proposta, informações
- Coluna direita: documentos, ações, formulários, comissão
- NUNCA usar 2 colunas em modais simples com menos de 4 seções

---

## §26. PADRÃO DE HEADER DE PÁGINA

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

## §27. PADRÃO DE CARDS KPI

Fonte única de verdade para KPI cards (também referenciado por §3).

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

## §28. SWITCHES E TOGGLES

Todos os switches/toggles do sistema devem seguir:

- Cor ativa: `bg-primary` — NUNCA azul ou hardcoded
- Cor inativa: bg-muted
- Verificar src/components/ui/switch.tsx — deve usar bg-primary quando checked

Containers que envolvem switches devem:
- Ter padding suficiente: px-3 py-2
- NUNCA usar overflow-hidden no elemento pai direto do switch
- Garantir que o switch não seja cortado pela borda do container

---

## §29. PADRÃO DE ABAS INTERNAS

Quando uma página tem menu de abas interno, a ordem obrigatória é:

1. Header da página (ícone + título + subtítulo) — ver §26
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

## §30. ESTRUTURA DO MENU — 15 seções

O menu lateral do sistema é organizado em 15 seções. O arquivo `navRegistry.ts` é a Fonte Única de Verdade (SSOT).

**Regras de classificação:**
- **INTEGRAÇÕES** = configurar conexão externa (API, OAuth, webhook, instâncias, API keys, sincronização de feeds)
- **ATENDIMENTO** = usar funcionalidades já conectadas (inbox, filas, regras, métricas)
- **CLIENTES** = dados do cliente (cadastro, avaliações, documentos)
- **OPERAÇÕES** = execução e checklists operacionais (instaladores, estoque, validação, checklists de projeto, agenda de serviços)
- **ENERGIA** = usar/monitorar dados de energia, tarifas e sincronização ANEEL (não configurar conexões)

**Princípio:** "Configurar conexão externa = INTEGRAÇÕES. Usar/monitorar dados = área funcional."

1. **PAINEL** — Painel Geral, Performance
2. **COMERCIAL** — Leads, Pipeline, Projetos, Acompanhamentos, Distribuição de Leads, SLA & Breaches, Inteligência Comercial, Aprovações
3. **ATENDIMENTO** — Central WhatsApp, Fila de Follow-ups, Regras de Follow-up, Métricas de Atendimento, Regras de Retorno, Fila de Retorno, Etiquetas WhatsApp, Respostas Rápidas
4. **CLIENTES** — Gestão de Clientes, Avaliações NPS, Documentos & Assinaturas
5. **PÓS-VENDA** — Dashboard, Preventivas, Planos, Checklists, Oportunidades
6. **OPERAÇÕES** — Instaladores, Estoque, Validação de Vendas, Tarefas & SLA, Documentação, Agenda de Serviços
7. **FINANCEIRO** — Recebimentos, Inadimplência, Comissões, Fiscal, Financiamentos, Premissas Fiscais, Política de Preços
8. **EQUIPE** — Consultores, Gamificação
9. **IA** — Copilot IA, Configuração de IA
10. **ENERGIA** — Unidades Consumidoras, Monitoramento Solar, Usinas, Alertas, Relatórios, SolarMarket Importação, Saúde Tarifária, Status Sync ANEEL
11. **INTEGRAÇÕES** — Catálogo de Integrações, Saúde das Integrações, Meta Ads Dashboard, Webhooks, Instâncias WhatsApp, Automação WhatsApp, Integrações Monitoramento, SolarMarket Config, Medidores, Google Maps, Instagram
12. **SITE** — Conteúdo & Visual, Serviços, Portfólio
13. **CADASTROS** — Disjuntores & Transf., Módulos Fotovoltaicos, Inversores, Baterias, Fornecedores, Concessionárias, Dicionário ANEEL, Versões de Tarifa, Premissas, Base Meteorológica
14. **CONFIGURAÇÕES** — Calculadora Solar, Status de Leads, Motivos de Perda, Loading & Mensagens
15. **ADMINISTRAÇÃO** — Empresa, Usuários & Permissões, Permissões por Papel, Auditoria, Notificações, Links & Captação, Release Notes, Atualizações, Personalizar Menus, Limpeza de Dados

---

## §31. CHANGELOG OBRIGATÓRIO

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
Para exceções, ver [Bloco 4](#bloco-4--conflitos-e-exceções-oficiais).

---

## §32. RESPONSIVIDADE OBRIGATÓRIA

Todo componente deve funcionar em mobile (320px) e desktop (1920px).

Regras obrigatórias:
- Grids: SEMPRE `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (adaptar conforme conteúdo)
- Texto: NUNCA truncar em mobile sem tooltip
- Modais: SEMPRE `w-[90vw]` com `max-w` definido
- Flex containers com itens que podem crescer: SEMPRE `flex-wrap`
- NUNCA width fixa em px para containers de conteúdo
- Botões em mobile: `min-h-[44px]` (touch target mínimo)
- Tabelas em mobile: `overflow-x-auto` no container pai

```tsx
// Grid responsivo padrão
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Flex responsivo com wrap
<div className="flex flex-wrap items-center gap-2">

// Tabela responsiva
<div className="rounded-lg border border-border overflow-x-auto">
  <Table>...</Table>
</div>

// Botão touch-friendly em mobile
<Button className="min-h-[44px] sm:min-h-0">Ação</Button>
```

NUNCA usar `w-[400px]`, `w-[500px]` ou qualquer largura fixa em containers de conteúdo.
SEMPRE testar visualmente em 320px e 1920px.

---

## §33. FLUXO PROPOSTA — Regras Críticas

### Persistência (useWizardPersistence.ts)
- SEMPRE sanitizar snapshot antes de salvar no banco
- NUNCA incluir `mapSnapshots` (base64) no payload do banco
- Helper obrigatório: `sanitizeSnapshot()` remove `mapSnapshots` e normaliza `grupo`
- Coluna `grupo`: SEMPRE normalizar para `"A"` ou `"B"` — NUNCA enviar valores brutos como `"B1"`, `"B2"`
- A RPC `create_proposta_nativa_atomic` também normaliza `grupo` internamente (migration aplicada)
- NUNCA enviar grupo raw ao banco por nenhum caminho — tanto frontend quanto RPC devem normalizar

### Edge Functions (proposalApi.ts)
- SEMPRE incluir `headers: { "x-client-timeout": "120" }` em `proposal-generate`, `proposal-render`, `proposal-send`
- Propostas complexas podem ultrapassar timeout padrão

### Payload de UCs (ProposalWizard.tsx)
- NUNCA usar spread `...rest` para enviar UCs ao backend
- SEMPRE usar whitelist explícita dos campos do `GenerateProposalPayload`
- Campos frontend-only PROIBIDOS no payload:
  `is_geradora`, `regra`, `grupo_tarifario`, `fase_tensao`,
  `demanda_consumo_rs`, `demanda_geracao_rs`,
  `tarifa_fio_b`, `tarifa_fio_b_p/fp`,
  `tarifa_tarifacao_p/fp`, `consumo_meses_p/fp`

### Campos com nomes diferentes (frontend → backend)
- `demanda_consumo_kw` → `demanda_preco`
- `demanda_geracao_kw` → `demanda_contratada`
- `fase_tensao` (mono/bi/tri) → `fase` (monofasico/bifasico/trifasico)

---

## §34. TABELA DE LEADS/ORÇAMENTOS — Padrão Obrigatório

### Alinhamento vertical obrigatório
- SEMPRE adicionar `align-middle` em `<TableRow>` e `<TableCell>` do `<TableBody>`
- NUNCA deixar células sem alinhamento vertical explícito em tabelas com conteúdo de altura variável
- Garante que todas as células fiquem centralizadas verticalmente quando o nome ou outro campo ocupa 2+ linhas

### Coluna TELEFONE
- SEMPRE `w-[155px] min-w-[155px]` na definição da `<TableHead>`
- SEMPRE `whitespace-nowrap` na célula `<TableCell>` do telefone
- NUNCA deixar o número quebrar em 2 linhas
- Ícone `Phone` + número na mesma linha com `shrink-0`

### Coluna AÇÕES — Responsividade obrigatória
- Em telas `lg+` (≥1024px): botões INLINE com `Tooltip`
  ```tsx
  <div className="hidden lg:flex items-center gap-1">
    {/* Cada botão: Button variant="ghost" size="icon" com TooltipProvider */}
  </div>
  ```
  Ícones padrão: `Eye` | `Pencil` | `MessageSquare` | `UserRound` | `ShoppingCart` | `Trash2`
  
  Cores dos ícones (cor base visível + hover mais escuro):
  - Ver detalhes (Eye): `text-primary hover:text-primary/80`
  - Editar (Pencil): `text-warning hover:text-warning/80`
  - WhatsApp (MessageSquare): `text-green-600 hover:text-green-700` (cor oficial da marca — exceção aceita)
  - Alterar consultor (UserRound): `text-info hover:text-info/80`
  - Converter (ShoppingCart): `text-primary hover:text-primary/80`
  - Excluir (Trash2): `text-destructive hover:text-destructive/80`

- Em telas `<lg`: `DropdownMenu` com botão `MoreHorizontal`
  ```tsx
  <div className="flex lg:hidden">
    <DropdownMenu>...</DropdownMenu>
  </div>
  ```

- NUNCA mostrar apenas 3 pontos em telas grandes
- SEMPRE manter condições de permissão por role (admin/consultor)

---

## §35. SIDEBAR — Padrão Visual Obrigatório

### Badge de notificação
- SEMPRE `bg-primary text-primary-foreground`
- Tamanho: `min-w-[20px] h-5 rounded-full text-xs font-bold flex items-center justify-center px-1`
- Quando item ATIVO: `bg-background text-primary` para contrastar com o fundo primário
- NUNCA cor hardcoded no badge

### Descrições dos itens
- NUNCA exibir descrição abaixo do nome do item como texto fixo
- SEMPRE usar Tooltip do shadcn/ui com `delayDuration={600}`
- `TooltipContent` com `side="right"`
- O texto do tooltip é a descrição do item de navegação

### Implementação obrigatória
```tsx
<TooltipProvider delayDuration={600}>
  <Tooltip>
    <TooltipTrigger asChild>
      <NavItem ... />
    </TooltipTrigger>
    <TooltipContent side="right">
      <p>{item.description}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## §36. FLEXBOX SCROLL — Regra obrigatória

Containers flexíveis (`flex-col`) que usam `flex-1` para preencher espaço e possuem conteúdo com scroll interno **DEVEM** incluir `min-h-0`.

Sem `min-h-0`, o elemento flex não encolhe abaixo do tamanho do conteúdo, impedindo `overflow-y-auto` de funcionar.

### Padrão obrigatório para painéis com scroll interno
```tsx
{/* Container pai — trava a altura */}
<div className="flex flex-col h-full min-h-0 overflow-hidden">
  
  {/* Header fixo — nunca encolhe */}
  <div className="shrink-0">
    {/* header/toolbar */}
  </div>
  
  {/* Conteúdo com scroll — flex-1 + min-h-0 */}
  <div className="flex-1 min-h-0 overflow-y-auto">
    {/* lista, chat, etc */}
  </div>
  
  {/* Footer fixo (opcional) — nunca encolhe */}
  <div className="shrink-0">
    {/* input, botões */}
  </div>
</div>
```

### Regras
- SEMPRE `min-h-0` em elementos `flex-1` dentro de `flex-col` que precisam scroll
- SEMPRE `shrink-0` em headers/footers fixos dentro de flex containers
- SEMPRE `overflow-hidden` no container pai para evitar scroll duplo
- Usar `gap-*` em vez de `space-y-*` no container flex (space-y interfere no cálculo de overflow)
- Em layouts full-height (ex: inbox), usar CSS para travar altura: `height: calc(100vh - 3.5rem)`

### Onde se aplica
- WhatsApp Inbox — **CRÍTICO**: coluna de lista de conversas e painel de chat são containers separados, cada um com `flex-col h-full overflow-hidden` próprio. NUNCA um scroll global englobando os dois.
- Sidebars com listas longas
- Qualquer painel split-view com scroll independente

---

## §37. STORAGE URLS — Resolução obrigatória

Paths internos do Supabase Storage (ex: `tenantId/identidade/arquivo.jpg`) **NÃO** funcionam como `src` de `<img>` ou `<a href>`. Devem ser convertidos em **signed URLs** antes de exibir.

### Helper obrigatório
```tsx
async function resolveStorageUrl(path: string, bucket = "documentos-clientes"): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
```

### Regras
- NUNCA usar path raw de storage como `src` de imagem ou link de download
- SEMPRE resolver com `createSignedUrl` (validade: 3600s padrão)
- URLs que já começam com `http` ou `data:` devem passar direto (já são válidas)
- Tratar `null` graciosamente — exibir placeholder se URL não resolver
- Aplicar em: previews de documentos, fotos de identidade, comprovantes, assinaturas

---

## §38. CONVERSÃO LEAD → VENDA — Dados técnicos obrigatórios

Ao converter lead em cliente/venda, os campos `potencia_kwp` e `valor_projeto` **DEVEM** ser preenchidos usando cadeia de fallback.

### Cadeia de fallback (em ordem de prioridade)
1. **Simulação selecionada** (`simulacoes.potencia_kwp`, `simulacoes.valor_total`)
2. **Última proposta nativa** (`proposta_nativas` → última `proposta_versoes.potencia_kwp`, `proposta_versoes.valor_total`)
3. **Dados do lead** (`leads.potencia_estimada`, `leads.valor_projeto`)
4. **Zero** como último recurso (nunca `null`)

### Regras
- NUNCA criar cliente com `potencia_kwp = null` e `valor_projeto = null` se existir proposta/simulação
- SEMPRE logar no console qual fonte de dados foi usada (`[ConvertLead] fonte: simulação | proposta | lead`)
- Documentos anexados (identidade, comprovante) devem ter URLs resolvidas via §37 antes de exibir no modal de aprovação
- Upload de documentos deve logar cada etapa e lançar erro explícito se todos falharem (nunca falha silenciosa)

---

# Bloco 4 — CONFLITOS E EXCEÇÕES OFICIAIS

### src/components/ui/ — exceções permitidas
- `switch.tsx` e `slider.tsx` podem ser editados para usar tokens semânticos (`bg-primary`)
- Todos os outros arquivos em `ui/` são intocáveis

### Changelog — exceções ao obrigatório (§31)
Changelog **NÃO** é obrigatório para:
- Correção de typos em texto/labels
- Lint fixes e formatação
- Refactor interno sem mudança funcional visível
- Reorganização de imports

### Exceções visuais confirmadas
| Componente | Exceção | Motivo |
|---|---|---|
| `SignaturePad` | `bg-white` sólido | Canvas de assinatura precisa de fundo branco |
| `GoogleMapView` | estilos inline do Google Maps | API externa controla renderização |
| Media player overlays | `bg-black/XX` | Padrão UX para players de vídeo/áudio |
| Heroes institucionais | `bg-white/XX` com opacidade | Overlays sobre gradientes em landing pages |
| KPI cards de estado/urgência | `border-l-destructive`, `border-l-warning`, `border-l-success` | Cards que representam estados distintos (urgente, pendente, ok) mantêm cores semânticas para clareza visual |
| Ícone WhatsApp (MessageSquare) | `text-[#25D366] hover:text-green-700` | Cor oficial da marca WhatsApp — exceção aceita em botões de ação |

### Ambiguidade: "sólido laranja" em botões (§22)
"SEMPRE sólido laranja" = usa `variant="default"` que renderiza `bg-primary`. A cor depende do tenant — pode ser laranja, azul ou qualquer outra. NUNCA hardcode `bg-orange-*`.

---

# Bloco 5 — VALIDAÇÃO ANTES DE FINALIZAR

Comandos obrigatórios antes de considerar uma tarefa concluída:

### 1. Build sem erros
```bash
npm run build
# Deve passar com zero erros
```

### 2. Grep de cores hardcoded
```bash
grep -rn "orange-\|blue-[0-9]\|#[0-9a-fA-F]\{3,6\}" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "\.test\." | grep -v "types\.ts"
# Não deve retornar nada em componentes de UI interativa
# Exceções: ver Bloco 4
```

### 3. staleTime em queries novas
```bash
grep -rn "useQuery" src/hooks/ --include="*.ts" --include="*.tsx" | xargs grep -L "staleTime"
# Deve retornar vazio (toda query tem staleTime)
```

### 4. Changelog atualizado
Se houve mudança funcional, verificar que `src/data/changelog.ts` foi atualizado.

---

# Bloco 6 — CONVENÇÕES DE NOMENCLATURA

### Idioma
- **PT-BR** para: labels de UI, textos, nomes de variáveis de domínio (`consultor`, `lead`, `proposta`)
- **EN** para: nomes de componentes, hooks, utilitários, tipos TypeScript

### Componentes
- `PascalCase`: `VendorDashboardView`, `LeadKanbanCard`

### Hooks
- `camelCase` com prefixo `use`: `useLeads`, `useCepLookup`, `useWizardPersistence`

### Arquivos de página
- `PascalCase` + sufixo `View` ou `Page`: `VendorWhatsAppView.tsx`, `AdminDashboardPage.tsx`

### Nav keys (navRegistry.ts)
- `kebab-case` em português: `gestao-clientes`, `monitoramento-solar`, `fila-followups`

### Tabelas Supabase
- `snake_case` em português: `consultor_metas`, `checklists_instalador`

### Edge Functions
- `kebab-case` em inglês: `proposal-generate`, `send-wa-message`

---

# Bloco 7 — ESCOPO POR ÁREA

Quais regras valem onde:

### TODAS as áreas
- Bloco 0 (checklist completo)
- Bloco 1 (regras bloqueantes)
- §1–§2 (cores, dark mode)
- §12 (loading states)
- §16 (queries em hooks)
- §22 (botões)
- §23 (staleTime)
- §32 (responsividade)

### Só admin (`/admin/*`)
- §6 (aproveitamento de tela)
- §21 (largura 100%)
- §26 (header de página)
- §29 (abas internas)
- §30 (estrutura do menu — 15 seções)

### Só portal consultor (`/consultor/*`)
- Bottom nav mobile (`VendorBottomNav.tsx`)
- Sidebar lateral (`VendorSidebar.tsx`)
- Botão "Voltar" em views mobile

### Modais e Dialogs
- §11 (estrutura de modal/drawer)
- §25 (tamanhos de modal — SSOT)

### Fluxo Proposta
- §33 (sanitização, whitelist, timeout)

### Gráficos e Dashboards
- §5 (Recharts com tokens semânticos)
- §27 (KPI cards — SSOT)

### Tabelas e Grids
- §4 (tabela padrão)
- §10 (grid denso para relatórios)

### Layouts com scroll interno (Inbox, sidebars, split-view)
- §36 (flexbox scroll obrigatório — aplica-se a QUALQUER painel com scroll independente)
- §39 (padrão universal de scroll — mais completo, prevalece em caso de dúvida)
- **WhatsApp Inbox**: cada coluna (lista de conversas + painel de chat) é um container de scroll independente. NUNCA scroll global na página.

### Storage e Documentos
- §37 (resolução de URLs obrigatória)

### Conversão Lead → Venda
- §38 (fallback de dados técnicos)


---

# Bloco 8 — WHATSAPP / MOBILE / MODAIS / AVATAR

Regras específicas para evitar reincidência de bugs validados no módulo WhatsApp e fluxos mobile.

---

## §39. SCROLL INTERNO — Padrão universal para painéis, chats, dialogs e drawers

Sempre que houver layout com **header + conteúdo + footer**, usar obrigatoriamente:

```tsx
<div className="flex flex-col h-full overflow-hidden">
  <div className="shrink-0">{/* header */}</div>
  <div className="flex-1 min-h-0 overflow-y-auto">{/* conteúdo */}</div>
  <div className="shrink-0">{/* footer */}</div>
</div>
```

### Regras
- SEMPRE `overflow-hidden` no container pai
- SEMPRE `shrink-0` em header e footer fixos
- SEMPRE `flex-1 min-h-0 overflow-y-auto` no conteúdo rolável
- Se usar `ScrollArea`: `<ScrollArea className="flex-1 min-h-0">`
- Se usar `Virtuoso`: `className="h-full min-h-0"` com `style={{ height: "100%", overflowY: "auto" }}`
- NUNCA `max-h-[70vh]` em body de dialog/sheet que já tem `max-h-[calc(100dvh-2rem)]` no container pai — causa dupla restrição e corta conteúdo no mobile
- NUNCA usar `max-h-[70vh]` no corpo do modal — usar `flex-1 min-h-0 overflow-y-auto` com o DialogContent sendo `flex flex-col max-h-[calc(100dvh-2rem)]`

### Onde se aplica
- WhatsApp Inbox — **CRÍTICO**: a coluna de lista de conversas e o painel de chat DEVEM ter scroll próprio e independente. NUNCA usar scroll global na página do inbox. Cada painel é um container `flex-col h-full overflow-hidden` separado.
- Qualquer `Dialog`, `Sheet`, `Drawer` com formulário longo
- Sidebars com listas longas
- Split-views com scroll independente

---

## §40. DIALOGS ANINHADOS NO MOBILE — Transição sequencial obrigatória

NUNCA renderizar um `Dialog` dentro de outro `Dialog` ativo no mobile. Causa:
- Sobreposição de overlays
- Scroll bloqueado
- Conteúdo cortado ou inacessível

### Padrão obrigatório
```tsx
// 1. Fechar o dialog pai ANTES de abrir o filho
const handleOpenChild = () => {
  onOpenChange(false); // fecha pai
  setTimeout(() => setChildOpen(true), 150); // abre filho após animação
};

// 2. Renderizar o dialog filho FORA do dialog pai (no mesmo nível de fragment)
return (
  <>
    <Dialog open={parentOpen} onOpenChange={onOpenChange}>
      {/* conteúdo do pai */}
    </Dialog>

    {/* Dialog filho — fora do pai */}
    {childOpen && (
      <ChildDialog open={childOpen} onOpenChange={setChildOpen} />
    )}
  </>
);
```

### Regras
- SEMPRE transição sequencial (fecha → delay → abre)
- SEMPRE renderizar dialog filho fora do dialog pai via fragment `<>...</>`
- Delay mínimo: `150ms` (tempo da animação de saída do Radix Dialog)
- Aplicar em: "Ver Lead" → "Editar Lead", "Info" → "Formulário", qualquer fluxo dialog-em-dialog

---

## §41. AVATAR / FOTO DE PERFIL — Extração robusta de múltiplas chaves

Webhooks de WhatsApp (Evolution API, Baileys, etc.) enviam a URL da foto de perfil em campos inconsistentes entre versões.

### Função obrigatória de extração
```tsx
function extractProfilePictureUrl(payload: Record<string, any>): string | null {
  const INVALID = new Set(["", "none", "null", "undefined"]);
  const candidates = [
    payload?.profilePictureUrl,
    payload?.imgUrl,
    payload?.profilePicUrl,
    payload?.pictureUrl,
    payload?.data?.profilePictureUrl,
    payload?.data?.imgUrl,
    payload?.data?.profilePicUrl,
    payload?.data?.pictureUrl,
  ];
  for (const url of candidates) {
    if (typeof url === "string" && url.trim() && !INVALID.has(url.trim().toLowerCase())) {
      return url.trim();
    }
  }
  return null;
}
```

### Regras
- NUNCA assumir um único campo (`profilePicUrl`) — SEMPRE verificar todos os candidatos
- SEMPRE filtrar valores inválidos: `""`, `"none"`, `"null"`, `"undefined"`
- SEMPRE verificar versões aninhadas em `data.*`
- O componente `WaProfileAvatar` já trata fallback (iniciais/ícone) — NUNCA duplicar essa lógica
- Ao persistir no banco (`wa_conversations.profile_picture_url`), usar a função de extração

---

## §42. ESCOPO DE CORREÇÃO — Regra anti-scope-creep

Ao receber um pedido de correção localizada:

### Regras
- NUNCA expandir o escopo além do pedido original
- NUNCA refatorar componentes adjacentes "por oportunidade"
- NUNCA alterar painéis/áreas não mencionados no pedido
- Se encontrar um bug adjacente: **anotar** e reportar ao usuário, mas NÃO corrigir na mesma entrega
- Cada entrega deve ter **checklist verificável** com itens OK/FALHOU
- Arquivos alterados devem ser listados explicitamente

### Formato de entrega para correções cirúrgicas
1. Arquivos exatos alterados
2. Causa raiz exata (1-2 linhas)
3. Diff real por arquivo
4. Código final dos trechos críticos
5. Checklist final com OK/FALHOU

---
