# 🔍 Relatório de Fricção do Vendedor — VENDOR_FRICTION_REPORT.md

**Data:** 2026-02-09  
**Escopo:** Fluxo LEAD → CONTATO → PROPOSTA → FECHAMENTO  
**Contexto:** Portal do Vendedor (`/vendedor`)

---

## 1. Resumo Executivo

O portal do vendedor está funcional e relativamente otimizado, mas existem **gargalos de cliques** e **sobrecarga visual** no dashboard que diluem o foco no funil principal (Lead → Venda).

| Métrica | Valor Atual |
|---------|-------------|
| Cliques para ver um lead novo | 2 (tab Orçamentos → olho) |
| Cliques para contatar via WhatsApp | 1 (link direto na tabela) ✅ |
| Cliques para gerar proposta PDF | 4 (olho → aba Proposta → configurar → baixar) |
| Cliques para converter lead em venda | 3 (olho ou carrinho → preencher → confirmar) |
| Widgets no Dashboard | **11+** widgets (sobrecarga cognitiva) |

---

## 2. Análise por Etapa do Funil

### 2.1 LEAD CHEGA → Vendedor vê

| Item | Status | Impacto |
|------|--------|---------|
| Badge de "Novos" na tab Orçamentos | ✅ Funcional | — |
| LeadAlerts no topo do dashboard | ✅ Funcional | — |
| Notificação push/som | ✅ Configurável | — |
| ⚠️ Leads novos não abrem automaticamente a tab Orçamentos | 🟡 Fricção | MÉDIO |
| ⚠️ Dashboard tem 11+ widgets antes da tabela de leads | 🔴 Alta fricção | ALTO |

**Problema principal:** O vendedor precisa navegar até a tab "Orçamentos" e rolar para ver a tabela. O dashboard é carregado com gamificação, calendários, métricas avançadas e ferramentas de produtividade que não são ações primárias.

### 2.2 CONTATO → Vendedor fala com lead

| Item | Status | Impacto |
|------|--------|---------|
| Link WhatsApp direto na tabela | ✅ 1 clique | — |
| Botão ligar no dialog de detalhes | ✅ Funcional | — |
| WhatsApp Inbox integrado | ✅ Tab dedicada | — |
| ⚠️ Não há botão "WhatsApp" direto no card mobile | 🟡 Fricção | MÉDIO |

### 2.3 PROPOSTA → Vendedor gera PDF

| Item | Status | Impacto |
|------|--------|---------|
| ProposalGenerator integrado ao dialog | ✅ Funcional | — |
| ⚠️ Precisa abrir detalhes → navegar para aba Proposta → configurar | 🟡 4 cliques | MÉDIO |
| ⚠️ PDF usa nome/telefone fixo da empresa (hardcoded) | 🟡 Inconsistência | BAIXO |
| ⚠️ Proposta não inclui logo da empresa | 🟡 Branding incompleto | BAIXO |
| Financiamento configurável no gerador | ✅ Funcional | — |

### 2.4 FECHAMENTO → Vendedor converte em cliente

| Item | Status | Impacto |
|------|--------|---------|
| ConvertLeadToClientDialog completo | ✅ Funcional | — |
| Auto-save parcial com restauração | ✅ Excelente UX | — |
| Upload de documentos offline | ✅ Funcional | — |
| Geolocalização integrada | ✅ Funcional | — |
| ⚠️ Formulário é extenso (15+ campos) | 🟡 Fricção | MÉDIO |
| ⚠️ Disjuntor e Transformador são obrigatórios para conversão | 🟡 Possível bloqueio | MÉDIO |
| ⚠️ Sem indicador visual de progresso no formulário | 🟡 UX | BAIXO |
| Status "Aguardando Documentação" como save parcial | ✅ Excelente | — |

---

## 3. Problemas de Performance (Impacto no Vendedor)

| Problema | Detalhe | Impacto |
|----------|---------|---------|
| 🔴 `useOrcamentosVendedor` carrega TODOS os orçamentos sem paginação | Vendedores com 200+ orçamentos sofrem delay | ALTO |
| 🔴 `IntelligenceDashboard` usa `pageSize: 500` | Carrega 500 leads de uma vez | ALTO |
| 🟡 11+ componentes no dashboard renderizam simultaneamente | TTI elevado | MÉDIO |
| 🟡 Realtime subscription genérica (sem filtro por vendedor no channel) | Recebe updates de todos os vendedores | BAIXO |

---

## 4. Sobrecarga Visual do Dashboard

O dashboard atual carrega **na ordem**:
1. LeadAlerts
2. VendedorShareLink
3. GoalProgressNotifications
4. VendorPersonalDashboard
5. Gamificação (Collapsible) — Goals, Achievements, Leaderboard
6. AdvancedMetricsCard
7. SyncStatusWidget + NotificationSettings
8. SmartReminders + WhatsAppTemplates
9. FollowUpStatsCards
10. FollowUpCalendar
11. LeadScoring

**Recomendação:** Apenas 1-4 são essenciais. Items 5-11 deveriam ser lazy-loaded ou movidos para sub-tabs.

---

## 5. Classificação de Melhorias

### 🔴 ALTO IMPACTO (Fazer primeiro)

| # | Melhoria | Esforço |
|---|----------|---------|
| 1 | Adicionar paginação ao `useOrcamentosVendedor` | Médio |
| 2 | Reduzir widgets do dashboard — mover gamificação/calendário para sub-tab | Médio |
| 3 | Lazy-load componentes pesados (LeadScoring, AdvancedMetrics) | Baixo |

### 🟡 MÉDIO IMPACTO

| # | Melhoria | Esforço |
|---|----------|---------|
| 4 | Botão "Gerar Proposta" direto na tabela (sem abrir dialog) | Baixo |
| 5 | Reduzir campos obrigatórios na conversão (disjuntor/transformador opcionais) | Baixo |
| 6 | Reduzir `pageSize: 500` no Intelligence para paginação real | Baixo |

### 🟢 BAIXO IMPACTO

| # | Melhoria | Esforço |
|---|----------|---------|
| 7 | Progress bar no formulário de conversão | Baixo |
| 8 | Logo dinâmica no PDF de proposta | Médio |
| 9 | Nome/telefone da empresa dinâmico no PDF | Baixo |

---

## 6. Fluxo Ideal (Proposta)

```
Lead chega → Push notification → Vendedor clica → 
Tab Orçamentos abre direto → Tabela com lead destacado →
1 clique: WhatsApp | 1 clique: Ver detalhes | 1 clique: Proposta rápida →
Proposta enviada → Converter em venda → Formulário simplificado → ✅
```

**Cliques atuais (pior caso):** 6-8  
**Cliques ideais:** 3-4
