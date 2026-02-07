# 🎨 Design System — Mais Energia Solar

## Visão Geral

O Design System da Mais Energia Solar segue uma abordagem **token-first**, onde todas as cores, espaçamentos e estilos visuais são definidos por variáveis CSS semânticas (HSL) e expostos via Tailwind CSS.

**Objetivo:** Garantir consistência visual entre todos os portais (Admin, Vendedor, Instalador, Institucional) com suporte a dark mode e acessibilidade.

---

## 🎨 Paleta de Cores (Tokens Semânticos)

### Core

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--primary` | `hsl(25, 100%, 50%)` | `hsl(25, 100%, 55%)` | Laranja Energia — CTAs, botões principais, destaques |
| `--primary-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Texto sobre primary |
| `--secondary` | `hsl(210, 100%, 40%)` | `hsl(210, 100%, 55%)` | Azul Corporativo — links, ícones info |
| `--secondary-foreground` | `hsl(0, 0%, 100%)` | `hsl(0, 0%, 100%)` | Texto sobre secondary |

### Status

| Token | Classe Tailwind | Uso |
|-------|-----------------|-----|
| `--success` | `text-success`, `bg-success`, `border-success` | Concluído, ativo, positivo |
| `--warning` | `text-warning`, `bg-warning`, `border-warning` | Alerta, em andamento, atenção |
| `--destructive` | `text-destructive`, `bg-destructive`, `border-destructive` | Erro, cancelado, perigo |
| `--info` | `text-info`, `bg-info`, `border-info` | Informação, dados secundários |

### Superfícies

| Token | Classe | Uso |
|-------|--------|-----|
| `--background` | `bg-background` | Fundo principal da página |
| `--card` | `bg-card` | Cards e painéis |
| `--muted` | `bg-muted` | Backgrounds sutis |
| `--accent` | `bg-accent` | Hover states |
| `--surface-1/2/3` | `surface-1/2/3` | Níveis de profundidade |

### ⛔ NUNCA USAR

```
❌ text-green-500, bg-green-100, text-amber-600, bg-red-50
❌ text-blue-700, bg-purple-500, text-yellow-500
```

Sempre usar os tokens semânticos:

```
✅ text-success, bg-success/10, text-warning, bg-destructive/5
✅ text-primary, bg-primary/10, text-secondary, bg-info/10
```

---

## 📝 Tipografia

| Elemento | Font | Classes |
|----------|------|---------|
| Títulos (h1-h3) | Plus Jakarta Sans | `font-display font-bold tracking-tight` |
| Corpo | Inter | `font-sans` |
| Código | JetBrains Mono | `font-mono` |

### Escala Tipográfica (definida em `index.css`)

- `h1`: `text-3xl md:text-4xl font-bold tracking-tight`
- `h2`: `text-2xl md:text-3xl font-semibold tracking-tight`
- `h3`: `text-xl md:text-2xl font-semibold`
- `h4`: `text-lg font-semibold`
- `h5`: `text-base font-semibold`
- `h6`: `text-sm font-semibold uppercase tracking-wider text-muted-foreground`

---

## 🔘 Botões

Usar o componente `Button` de `@/components/ui/button`:

| Variante | Uso | Exemplo |
|----------|-----|---------|
| `default` | Ação principal | Salvar, Enviar, Criar |
| `secondary` | Ação secundária | Cancelar, Voltar |
| `outline` | Ação terciária | Filtros, opções |
| `ghost` | Ação sutil | Ícones em toolbars |
| `destructive` | Ação perigosa | Excluir, Remover |
| `link` | Navegação inline | Ver mais, Detalhes |

### Estados

Todos os botões devem ter:
- ✅ `hover` — feedback visual
- ✅ `disabled` — opacidade + cursor not-allowed
- ✅ `loading` — `<Loader2 className="animate-spin" />` + disabled
- ✅ `focus-visible` — ring de foco (automático via Tailwind)

---

## 📦 Cards

```tsx
// Card padrão
<Card className="border-l-4 border-l-primary">
  <CardContent>...</CardContent>
</Card>

// Card interativo (hover lift)
<Card className="card-interactive">
  <CardContent>...</CardContent>
</Card>

// Card com destaque
<Card className="card-highlight">
  <CardContent>...</CardContent>
</Card>
```

---

## 📊 Stats Cards Pattern

```tsx
<Card className="border-l-4 border-l-{token}">
  <CardContent className="flex items-center gap-4 p-4">
    <div className="w-10 h-10 rounded-full bg-{token}/10 flex items-center justify-center">
      <Icon className="w-5 h-5 text-{token}" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </CardContent>
</Card>
```

Tokens válidos: `primary`, `secondary`, `success`, `warning`, `destructive`, `info`

---

## 🎭 Sidebar (Admin)

O sidebar usa tokens de seção definidos em `index.css`:
- `--sidebar-section-analytics` (roxo)
- `--sidebar-section-finance` (verde)
- `--sidebar-section-sales` (azul)
- `--sidebar-section-operations` (laranja)
- `--sidebar-section-apis` (ciano)
- `--sidebar-section-config` (amarelo)

Classes Tailwind: `text-sidebar-analytics`, `bg-sidebar-finance/10`, etc.

---

## 🔄 Status Colors para Serviços/Pipeline

| Status | Token |
|--------|-------|
| Agendado | `info` (`bg-info/20 text-info`) |
| Em andamento | `warning` (`bg-warning/20 text-warning`) |
| Concluído | `success` (`bg-success/20 text-success`) |
| Cancelado | `destructive` (`bg-destructive/20 text-destructive`) |
| Reagendado | `sidebar-analytics` ou custom |

---

## 📄 Paginação

Usar `usePaginatedQuery` + `PaginationControls`:

```tsx
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { PaginationControls } from "@/components/ui/pagination-controls";

const { data, isLoading, page, totalPages, totalCount, pageSize, 
        isFetching, goToPage, nextPage, prevPage, hasNextPage, hasPrevPage } = 
  usePaginatedQuery({
    queryKey: "admin-leads",
    table: "leads",
    select: "*, lead_status(nome, cor)",
    searchTerm: search,
    searchColumns: ["nome", "telefone", "cidade"],
  });

// No JSX:
<PaginationControls
  page={page} totalPages={totalPages} totalCount={totalCount}
  pageSize={pageSize} isFetching={isFetching}
  onGoToPage={goToPage} onNextPage={nextPage} onPrevPage={prevPage}
  hasNextPage={hasNextPage} hasPrevPage={hasPrevPage}
/>
```

---

## ✨ Efeitos e Micro-interações

| Classe | Efeito |
|--------|--------|
| `interactive` | Scale down + brightness on click |
| `hover-lift` | Translate Y -0.5 + shadow on hover |
| `hover-glow-primary` | Primary color glow shadow |
| `glass` | Blur background + semi-transparent |
| `gradient-solar` | Orange gradient (primary brand) |
| `gradient-blue` | Blue gradient (secondary brand) |
| `animate-fade-in` | Fade in with slide up |
| `animate-scale-in` | Scale up entrance |

---

## ♿ Acessibilidade

- ✅ Contraste mínimo WCAG AA em todos os tokens
- ✅ `focus-visible` ring em todos os interativos
- ✅ `prefers-reduced-motion` desabilita animações
- ✅ Labels em todos os inputs
- ✅ `aria-label` em botões de ícone

---

## 📋 Checklist de QA para Releases

- [ ] Cores: nenhum uso de classes Tailwind hardcoded (green-500, amber-600, etc.)
- [ ] Botões: todos com hover, disabled e loading states
- [ ] Inputs: todos com label e estado de erro
- [ ] Dark mode: testar todos os portais
- [ ] Mobile: testar responsividade em 360px e 768px
- [ ] Acessibilidade: testar navegação por teclado
- [ ] Performance: queries paginadas em listagens > 50 itens
- [ ] Audit logs: ações críticas geram registro automático
