# 🎨 Design System — Soft Depth (v2)

> Linguagem visual oficial do sistema. Nenhum componente, tela ou feature pode violar estas regras.

**Estilo**: Soft Depth — elevação suave, bordas sutis, alto contraste, aparência premium.  
**Referência**: Stripe, Linear, Notion.  
**Versão**: 2.0 — Atualizado em 2026-02-13

---

## 🚫 Proibições Absolutas

| Proibido | Motivo |
|----------|--------|
| `glassmorphism` / `backdrop-blur` em cards | Ruído visual, inconsistência |
| Gradientes fortes (`gradient-solar`, `gradient-blue`) | Exagero visual — REMOVIDOS do CSS |
| `badge-glow` / `hover-glow-*` | Efeitos desnecessários — REMOVIDOS do CSS |
| Sombras pesadas (`shadow-2xl` em cards comuns) | Desproporcional |
| Cores hardcoded (`bg-orange-500`, `text-blue-600`) | Quebra tematização |
| `rounded-full` em ícones decorativos | Padrão é `rounded-xl` |
| Criar botão/card/badge customizado por tela | Use os componentes do design system |
| `glass`, `glass-strong`, `glass-card` | REMOVIDOS — usar `surface-1/2/3` + `shadow-sm/md` |

### ⛔ NUNCA USAR em componentes

```
❌ text-green-500, bg-green-100, text-amber-600, bg-red-50
❌ text-blue-700, bg-purple-500, text-yellow-500
❌ text-white (usar text-primary-foreground)
❌ bg-black (usar bg-foreground)
```

Sempre usar os tokens semânticos:
```
✅ text-success, bg-success/10, text-warning, bg-destructive/5
✅ text-primary, bg-primary/10, text-secondary, bg-info/10
✅ text-foreground, text-muted-foreground, bg-card, bg-background
```

---

## 🎯 Tokens Globais

### Cores Semânticas (HSL — definidas em `index.css`)

| Token | Uso |
|-------|-----|
| `--background` | Fundo da página |
| `--foreground` | Texto principal |
| `--card` / `--card-foreground` | Superfície de cards |
| `--primary` / `--primary-foreground` | Ações principais, CTAs |
| `--secondary` / `--secondary-foreground` | Ações secundárias |
| `--muted` / `--muted-foreground` | Elementos desabilitados, labels |
| `--accent` / `--accent-foreground` | Hover states, destaques sutis |
| `--destructive` | Erros, exclusões |
| `--success` | Confirmações, status positivo |
| `--warning` | Alertas |
| `--info` | Informações neutras |
| `--border` | Bordas padrão |
| `--input` | Borda de inputs |
| `--ring` | Focus ring |

### Superfícies de Elevação

| Token | Tailwind | Uso |
|-------|----------|-----|
| `--surface-1` | `bg-surface-1` | Card base (= `--card`) |
| `--surface-2` | `bg-surface-2` | Background elevado sutil |
| `--surface-3` | `bg-surface-3` | Background de seções internas |

### Sombras (Soft Depth Scale)

| Classe Tailwind | CSS Var | Uso |
|-----------------|---------|-----|
| `shadow-xs` | `--shadow-xs` | Inputs, badges |
| `shadow-sm` | `--shadow-sm` | Cards em repouso |
| `shadow-md` | `--shadow-md` | Cards em hover, dropdowns |
| `shadow-lg` | `--shadow-lg` | Modais, popovers |
| `shadow-xl` | `--shadow-xl` | Dialogs |

> **Nunca** use `shadow-2xl` em componentes comuns. Reservado para overlays fullscreen.

### Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `rounded-sm` | `calc(0.5rem - 4px)` | Badges internos |
| `rounded-md` | `calc(0.5rem - 2px)` | Inputs, switches |
| `rounded-lg` | `0.5rem` | Buttons |
| `rounded-xl` | `calc(0.5rem + 4px)` | Cards, ícones decorativos |
| `rounded-2xl` | `calc(0.5rem + 8px)` | Modais, sections |

### Tipografia

| Elemento | Font | Weight | Size |
|----------|------|--------|------|
| H1 | Plus Jakarta Sans | 700 (bold) | 2xl → 4xl |
| H2 | Plus Jakarta Sans | 600 | xl → 3xl |
| H3 | Plus Jakarta Sans | 600 | lg → 2xl |
| H4 | Plus Jakarta Sans | 600 | lg |
| Body | Inter | 400 | sm-base |
| Label | Inter | 500 | xs-sm |
| Mono | JetBrains Mono | 400 | sm |

### Spacing Scale

| Uso | Valor |
|-----|-------|
| Card padding | `p-5 sm:p-6` |
| Section gap | `space-y-6` |
| Element gap | `gap-2` a `gap-4` |
| Page padding | `p-4 sm:p-6` |
| Icon + text | `gap-2` (sm), `gap-2.5` (md) |

---

## 🧩 Componentes Oficiais

### Primitivos (`src/components/ui/`)

| Componente | Status | Especificação |
|------------|--------|---------------|
| `<Card>` | ✅ | `rounded-xl border-border/60 bg-card shadow-sm` |
| `<Button>` | ✅ | 10 variants (default, soft, success, warning, destructive, outline, ghost, link, secondary, soft-secondary), 7 sizes |
| `<Badge>` | ✅ | 12 variants incluindo `soft-*` para status |
| `<Input>` | ✅ | `shadow-xs`, hover `border-muted-foreground/30`, focus `ring-ring/40` |
| `<Dialog>` | ✅ | `rounded-2xl shadow-xl`, overlay `bg-black/60 backdrop-blur-sm` |
| `<Table>` | ✅ | Header `bg-muted/30`, hover `bg-muted/50`, border `border-border/50` |
| `<Select>` | ✅ | Shadcn padrão |
| `<Tabs>` | ✅ | Shadcn padrão |

### Compostos (`src/components/ui-kit/`)

| Componente | Uso | Regras |
|------------|-----|--------|
| `<PageHeader>` | Título de página com ícone + ações | Obrigatório em toda página |
| `<SectionCard>` | Card com header (título + ícone + ações) + body | Usar para agrupar conteúdo |
| `<StatCard>` | Métrica com ícone + `border-left` | **EXCLUSIVO** para métricas. Único com `border-left` |
| `<EmptyState>` | Estado vazio com ícone `rounded-xl` + CTA | Obrigatório em listas vazias |
| `<StatusBadge>` | Badge com dot colorido | Obrigatório para status |
| `<IconBadge>` | Ícone decorativo `rounded-xl` | Padroniza ícones em listas |
| `<SearchInput>` | Input com ícone de busca | Obrigatório em filtros de busca |
| `<LoadingState>` | Loader temático configurável | Obrigatório para loading de página |
| `<Spinner>` | Micro-loader para botões/inline | Substituir `Loader2` solto |

### Regras de Uso

1. **Toda página** deve usar `<PageHeader>` no topo
2. **Toda seção** de conteúdo deve usar `<SectionCard>` ou `<Card>`
3. **Nenhum card** pode ter `border-left` exceto `<StatCard>`
4. **Status** sempre via `<StatusBadge>` com variante semântica
5. **Ícones decorativos** sempre via `<IconBadge>` com `rounded-xl`
6. **Busca** sempre via `<SearchInput>` padronizado
7. **Loading** sempre via `<LoadingState>` ou `<Spinner>` (nunca `Loader2` solto)
8. **Cards hero/destaque** usar `bg-primary text-primary-foreground` (não gradientes)

---

## 🎭 Estados Visuais

### Card em Repouso
```css
border: border-border/60
shadow: shadow-sm
bg: bg-card
```

### Card em Hover (`.card-interactive`)
```css
border: border-border/80
shadow: shadow-md
transform: translateY(-1px)
```

### Card Destacado (`.card-highlight` — uso restrito)
```css
border: border-primary/25
shadow: inset 0 0 0 1px primary/6 + shadow-sm
```

### Botão Primário em Hover
```css
bg: primary/90
shadow: shadow-md + shadow-primary/20
transform: translateY(-1px)
```

### Input em Focus
```css
ring: ring-2 ring-ring/40
border: border-ring
offset: ring-offset-1
```

---

## 📐 Padrão de Tela Admin

```tsx
<div className="admin-content">
  <PageHeader icon={Icon} title="Título" actions={<Button>Ação</Button>} />
  
  {/* Stats row (opcional) */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <StatCard icon={X} label="Label" value={42} color="primary" />
    <StatCard icon={Y} label="Label" value={18} color="success" />
  </div>
  
  {/* Content */}
  <SectionCard icon={Z} title="Seção" actions={<SearchInput />}>
    <Table>...</Table>
  </SectionCard>
</div>
```

---

## 📋 Classes CSS Utilitárias Permitidas

| Classe | Uso |
|--------|-----|
| `stat-card` | Alternativa CSS para StatCard |
| `content-section` | Alternativa CSS para SectionCard |
| `page-header` | Alternativa CSS para PageHeader |
| `premium-table` | Estilos de tabela premium |
| `empty-state` | Alternativa CSS para EmptyState |
| `interactive` | Feedback tátil (scale + brightness) |
| `hover-lift` | Elevação suave no hover |
| `card-interactive` | Card com hover state |
| `card-highlight` | Card com destaque primary |
| `gradient-soft` | Transição suave surface-2 → background (único gradiente permitido) |
| `divider-gradient` | Divisor horizontal sutil |
| `admin-content` | Container padrão de conteúdo admin |
| `scrollbar-thin` | Scrollbar minimalista |
| `skeleton-pulse` | Placeholder de loading |

---

## ✅ Checklist Antes de Criar Componente

- [ ] Existe um componente no ui-kit que resolve isso?
- [ ] As cores usam tokens semânticos (nunca hardcoded)?
- [ ] O border-radius segue a escala (`rounded-xl` para cards)?
- [ ] A sombra segue a Soft Depth scale (`shadow-sm` default)?
- [ ] Funciona em dark mode?
- [ ] Sem glassmorphism, gradientes fortes, ou glow?
- [ ] Responsivo (mobile-first)?
- [ ] Usa `text-foreground` / `text-muted-foreground` (nunca `text-white` / `text-black`)?

---

## ♿ Acessibilidade

- ✅ Contraste mínimo WCAG AA em todos os tokens
- ✅ `focus-visible` ring em todos os interativos
- ✅ `prefers-reduced-motion` desabilita animações
- ✅ Labels em todos os inputs
- ✅ `aria-label` em botões de ícone
- ✅ `role="status"` em loaders

---

*Versão 2.0 — Soft Depth | Última atualização: 2026-02-13*
