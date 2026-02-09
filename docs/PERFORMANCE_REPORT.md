# ⚡ Relatório de Performance — PERFORMANCE_REPORT.md

**Data:** 2026-02-09  
**Critério:** Identificar telas acima de 2 segundos de carregamento  
**Método:** Análise estática de código (queries, imports, rendering)

---

## 1. Telas de Risco (Estimativa de TTI > 2s)

| # | Tela | Risco | Causa Principal |
|---|------|-------|-----------------|
| 🔴 1 | **Portal do Vendedor (Dashboard)** | ALTO | 11+ widgets renderizados simultaneamente, sem lazy loading. `useOrcamentosVendedor` sem paginação carrega todos os orçamentos. |
| 🔴 2 | **Intelligence Dashboard (Admin)** | ALTO | `useLeads({ pageSize: 500 })` carrega 500 leads + scoring em memória. |
| 🟡 3 | **Admin Panel (primeira carga)** | MÉDIO | Módulo monolítico com 40+ componentes importados. Sidebar + content carregados juntos. |
| 🟡 4 | **WaInbox (WhatsApp)** | MÉDIO | Carrega todas conversas + mensagens sem virtualização. Polling ativo. |
| 🟡 5 | **ConvertLeadToClientDialog** | MÉDIO | 3 queries paralelas ao abrir (disjuntores, transformadores, simulações) + restauração de localStorage. |
| 🟢 6 | **Site Institucional** | BAIXO | Imagens otimizadas, componentes leves. Header/Footer com brand settings (1 query). |
| 🟢 7 | **Calculadora** | BAIXO | Componente local, cálculos em memória. |
| 🟢 8 | **Tela de Login** | BAIXO | Componente simples com 1 query (brand settings). |

---

## 2. Análise Detalhada

### 🔴 Portal do Vendedor — Dashboard

**Componentes carregados no mount:**
```
LeadAlerts → useLeads() interno ou leadsForAlerts prop
VendedorShareLink
GoalProgressNotifications
VendorPersonalDashboard
Gamificação (Goals, Achievements, Leaderboard)
AdvancedMetricsCard
SyncStatusWidget
NotificationSettings
SmartReminders
WhatsAppTemplates
FollowUpStatsCards
FollowUpCalendar
LeadScoring
```

**Queries no mount:**
1. `useOrcamentosVendedor` — SELECT * FROM orcamentos JOIN leads (sem limit)
2. `useGamification` — múltiplas queries (achievements, goals, ranking)
3. `useAdvancedMetrics` — cálculos sobre todos orçamentos
4. `lead_status` — SELECT * 

**Estimativa:** 3-5s em conexões lentas com 200+ orçamentos.

**Solução:**
- Paginação no `useOrcamentosVendedor` (pageSize: 50)
- Lazy-load para: Gamificação, AdvancedMetrics, FollowUpCalendar, LeadScoring
- Mover widgets secundários para sub-tabs

---

### 🔴 Intelligence Dashboard

**Query:** `useLeads({ pageSize: 500 })` — linha 13 de IntelligenceDashboard.tsx

**Problema:** Carrega 500 leads de uma vez, calcula scores em memória.

**Solução:** 
- Usar scoring pré-calculado do banco (`lead_scores` table) em vez de recalcular no frontend
- Paginação com cursor

---

### 🟡 Admin Panel

**Problema:** `Admin.tsx` importa todos os 40+ managers como um monolito.

**Solução:**
- `React.lazy()` para cada tab/manager
- Carregar apenas o componente ativo

---

### 🟡 WaInbox

**Problema:** 
- Carrega todas as conversas sem paginação
- Mensagens carregadas por conversa (sem virtualização)
- Polling ativo para novas mensagens

**Solução:**
- Paginação de conversas (20 por vez)
- Virtualização de mensagens (react-window ou similar)
- Realtime subscription em vez de polling

---

## 3. Queries Pesadas Identificadas

| Query | Arquivo | Rows Estimadas | Solução |
|-------|---------|----------------|---------|
| `SELECT * FROM orcamentos JOIN leads` (sem limit) | `useOrcamentosVendedor.ts` | 100-500 | Paginação |
| `SELECT * FROM leads LIMIT 500` | `IntelligenceDashboard.tsx` | 500 | Reduzir / usar scores pré-calculados |
| `SELECT * FROM wa_conversations` (sem limit) | `useWaInbox.ts` | 100-1000 | Paginação + filtro por status |
| N+1 queries em `process-wa-followups` | Edge Function | Variável | Batch/join |

---

## 4. Recomendações Prioritárias

### Prioridade Absoluta (TTI > 2s)

| # | Ação | Arquivo | Esforço |
|---|------|---------|---------|
| 1 | Adicionar paginação ao `useOrcamentosVendedor` | `src/hooks/useOrcamentosVendedor.ts` | Médio |
| 2 | Lazy-load widgets do dashboard vendedor | `src/pages/VendedorPortal.tsx` | Baixo |
| 3 | Reduzir `pageSize: 500` → usar scores do banco | `src/components/admin/intelligence/IntelligenceDashboard.tsx` | Baixo |

### Prioridade Alta

| # | Ação | Arquivo | Esforço |
|---|------|---------|---------|
| 4 | `React.lazy()` nos managers do Admin | `src/pages/Admin.tsx` | Médio |
| 5 | Paginação no WaInbox | `src/hooks/useWaInbox.ts` | Médio |

### Prioridade Média

| # | Ação | Arquivo | Esforço |
|---|------|---------|---------|
| 6 | Batch queries no `process-wa-followups` | `supabase/functions/process-wa-followups/index.ts` | Médio |
| 7 | Deduplicação no `process-webhook-events` | `supabase/functions/process-webhook-events/index.ts` | Médio |

---

## 5. Métricas Atuais vs Meta

| Tela | TTI Estimado | Meta | Gap |
|------|-------------|------|-----|
| Vendedor Dashboard | ~3-5s | <2s | 🔴 1-3s |
| Intelligence | ~3-4s | <2s | 🔴 1-2s |
| Admin Panel | ~2-3s | <2s | 🟡 0-1s |
| WaInbox | ~2-3s | <2s | 🟡 0-1s |
| Site Institucional | ~1s | <2s | ✅ OK |
| Login | ~1s | <2s | ✅ OK |
| Calculadora | ~0.5s | <2s | ✅ OK |
