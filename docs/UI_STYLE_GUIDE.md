# 🎨 UI Style Guide — Mais Energia Solar

## UI Kit Components

All reusable components live in `src/components/ui-kit/` and are exported from `src/components/ui-kit/index.ts`.

### PageHeader
Page-level header with icon, title, description and action buttons.

```tsx
import { PageHeader } from "@/components/ui-kit";
import { Users } from "lucide-react";

<PageHeader
  icon={Users}
  title="Clientes"
  description="Gerencie os clientes da sua base"
  actions={<Button>Novo Cliente</Button>}
/>
```

### StatCard
Metric display card with colored left border and icon badge.

```tsx
import { StatCard } from "@/components/ui-kit";
import { Receipt } from "lucide-react";

<StatCard
  icon={Receipt}
  label="Total Recebido"
  value="R$ 125.000"
  color="success"  // primary | secondary | success | warning | destructive | info | muted
/>
```

### SectionCard
Wrapper card with optional header, description and actions.

```tsx
import { SectionCard } from "@/components/ui-kit";
import { Settings } from "lucide-react";

<SectionCard icon={Settings} title="Configurações" description="Ajuste as preferências">
  <p>Conteúdo aqui</p>
</SectionCard>
```

### EmptyState
Centered placeholder with icon, message and optional CTA.

```tsx
import { EmptyState } from "@/components/ui-kit";
import { Users, Plus } from "lucide-react";

<EmptyState
  icon={Users}
  title="Nenhum cliente encontrado"
  description="Cadastre um novo cliente para começar"
  action={{ label: "Novo Cliente", onClick: () => {}, icon: Plus }}
/>
```

### StatusBadge
Semantic status indicator badge with optional dot.

```tsx
import { StatusBadge } from "@/components/ui-kit";

<StatusBadge variant="success" dot>Ativo</StatusBadge>
<StatusBadge variant="warning">Pendente</StatusBadge>
<StatusBadge variant="destructive">Cancelado</StatusBadge>
// Variants: success | warning | destructive | info | primary | secondary | muted
```

### IconBadge
Circular icon with semantic color background.

```tsx
import { IconBadge } from "@/components/ui-kit";
import { Zap } from "lucide-react";

<IconBadge icon={Zap} color="primary" size="md" />
// Sizes: sm (28px) | md (36px) | lg (44px)
```

### LoadingState
Centered spinner with optional message.

```tsx
import { LoadingState } from "@/components/ui-kit";

<LoadingState message="Carregando dados..." />
```

### SearchInput
Pre-styled search input with magnifying glass icon.

```tsx
import { SearchInput } from "@/components/ui-kit";

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Buscar por nome..."
/>
```

---

## Color Tokens (Semantic)

**NEVER** use raw Tailwind colors (`text-green-500`, `bg-red-100`, etc.). Always use semantic tokens:

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `primary` | `hsl(28, 95%, 53%)` | `hsl(28, 85%, 56%)` | Brand orange — CTAs, main actions |
| `secondary` | `hsl(225, 78%, 30%)` | `hsl(225, 60%, 48%)` | Navy blue — links, info icons |
| `success` | `hsl(158, 50%, 38%)` | `hsl(158, 45%, 42%)` | Completed, active, positive |
| `warning` | `hsl(38, 72%, 48%)` | `hsl(38, 65%, 50%)` | Alerts, pending, attention |
| `destructive` | `hsl(4, 62%, 46%)` | `hsl(4, 58%, 46%)` | Errors, cancelled, danger |
| `info` | `hsl(210, 58%, 48%)` | `hsl(210, 52%, 52%)` | Information, secondary data |

### Usage patterns

```tsx
// ✅ Correct — semantic tokens
<Badge className="bg-success/15 text-success border-success/20">Ativo</Badge>
<Badge className="bg-warning/15 text-warning border-warning/20">Pendente</Badge>
<div className="bg-destructive/5 border-destructive/30">Error box</div>

// ❌ Wrong — hardcoded colors
<Badge className="bg-green-500 text-white">Ativo</Badge>
<Badge className="bg-yellow-500 text-white">Pendente</Badge>
```

---

## Layout Pattern

Every admin page should follow this structure:

```tsx
<div className="space-y-6">
  <PageHeader icon={...} title="..." description="..." actions={...} />
  
  {/* Optional: Tabs */}
  <Tabs>
    <TabsList>
      <TabsTrigger className="gap-2">
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">Label</span>
      </TabsTrigger>
    </TabsList>
    <TabsContent className="space-y-6 mt-6">...</TabsContent>
  </Tabs>

  {/* Stats row */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard ... />
  </div>

  {/* Filters + Actions bar */}
  <div className="flex flex-col sm:flex-row gap-4 justify-between">
    <SearchInput ... />
    <Button>Action</Button>
  </div>

  {/* Content: Table or Cards */}
  {loading ? <LoadingState /> : data.length === 0 ? <EmptyState ... /> : <Card><Table>...</Table></Card>}
</div>
```

---

## Icons

- Library: `lucide-react` everywhere
- Standard sizes: `h-4 w-4` (inline), `h-5 w-5` (headers), `h-7 w-7` (empty states)
- Always use `shrink-0` on icons in flex containers

---

## Typography

| Element | Font | Classes |
|---------|------|---------|
| Page titles | Plus Jakarta Sans | `text-2xl font-display font-bold tracking-tight` |
| Section titles | Inter | `text-base font-semibold` |
| Body | Inter | `text-sm` |
| Captions | Inter | `text-xs text-muted-foreground` |

---

## Spacing

- Page sections: `space-y-6`
- Card internals: `p-4` or `p-5`
- Grid gaps: `gap-4`
- Button groups: `gap-2`
