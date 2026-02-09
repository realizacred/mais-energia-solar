# 🏗️ Arquitetura de Menu SaaS — Proposta v1

**Data:** 2026-02-09  
**Status:** AGUARDANDO APROVAÇÃO  
**Escopo:** Reorganização da `sidebarConfig.ts` (information architecture only)  
**Impacto:** Nenhuma rota, permissão, favorito ou funcionalidade alterada.

---

## 1. Filosofia

Inspiração: HubSpot, Pipedrive, Ploomes, Salesforce Lightning.

| Princípio | Aplicação |
|-----------|-----------|
| **Fluxo do dinheiro** | Menu segue a jornada: captar → converter → entregar → receber |
| **Contexto único** | Cada seção agrupa itens que o usuário pensa "junto" |
| **Frequência de uso** | Itens mais usados ficam no topo, configurações no fundo |
| **Profundidade mínima** | Máximo 1 nível de agrupamento (seção → itens) |
| **Previsibilidade** | Nomenclatura padronizada e consistente |

---

## 2. Estrutura Atual vs Proposta

### Atual (11 seções)

```
1. Visão Geral (Dashboard, Release Notes)
2. Comercial (Leads, Pipeline, Follow-ups, Distribuição, SLA, Propostas, Aprovações, Status, Motivos Perda, Inteligência)
3. Atendimento (Inbox WA, Follow-up WA, Respostas Rápidas, Validação, Tarefas)
4. Clientes (Gestão, Documentação, Avaliações, Agenda Técnica)
5. Operações (Instaladores)
6. Financeiro (Recebimentos, Inadimplência, Comissões, Engenharia Fin., Bancos)
7. Cadastros (Vendedores, Usuários, Equipamentos x4, Concessionárias, Calculadora, Gamificação)
8. IA (Copilot)
9. Integrações & Automação (WA Instances, WA API, Instagram, SolarMarket, Webhooks, Automações)
10. Site Institucional (Conteúdo, Serviços, Portfólio)
11. Administração (Auditoria)
```

**Problemas identificados:**
- ❌ "Comercial" tem 10 itens (sobrecarga)
- ❌ "Cadastros" mistura equipe (Vendedores, Usuários) com equipamentos (Módulos, Baterias)
- ❌ "Operações" tem apenas 1 item (desperdício de seção)
- ❌ "IA" tem apenas 1 item (desperdício de seção)
- ❌ "Atendimento" mistura inbox com configurações (Respostas Rápidas, Follow-up rules)
- ❌ Gamificação está em "Cadastros" (deslocada)
- ❌ Calculadora Solar está em "Cadastros" (é configuração)

---

### Proposta (12 seções)

```
 #  SEÇÃO              ITENS                                          defaultOpen
─── ─────────────────── ────────────────────────────────────────────── ───────────
 1  Dashboard           Dashboard                                     true
 2  Comercial           Leads, Pipeline, Propostas, Follow-ups,       true
                        Distribuição, SLA & Breaches,
                        Inteligência Comercial
 3  Conversas           Central WhatsApp, Follow-up WhatsApp          true
 4  Clientes            Gestão de Clientes, Documentação,             true
                        Avaliações, Agenda Técnica
 5  Operações           Instaladores, Validação, Tarefas & SLA        false
 6  Financeiro          Recebimentos, Inadimplência, Comissões,       false
                        Engenharia Financeira, Bancos
 7  Gestão              Vendedores, Aprovações, Gamificação,          false
                        Release Notes
 8  IA                  Copilot IA                                    false
 9  Integrações         Instâncias WA, WhatsApp API, Instagram,       false
                        SolarMarket, Webhooks, Automações
10  Site                Conteúdo & Visual, Serviços, Portfólio        false
11  Configurações       Calculadora Solar, Lead Status,               false
                        Motivos de Perda, Respostas Rápidas,
                        Equipamentos (Disj./Transf.),
                        Módulos, Inversores, Baterias,
                        Concessionárias
12  Administração       Usuários & Permissões, Auditoria (Logs)       false
```

---

## 3. Mudanças Item a Item

| Item | De (seção atual) | Para (seção nova) | Justificativa |
|------|-------------------|-------------------|---------------|
| Dashboard | Visão Geral | **Dashboard** | Seção própria, sempre aberta |
| Release Notes | Visão Geral | **Gestão** | Pouco acessado, não é ação primária |
| Leads | Comercial | Comercial | ✅ Mantém |
| Pipeline | Comercial | Comercial | ✅ Mantém |
| Propostas | Comercial | Comercial | ✅ Mantém |
| Follow-ups | Comercial | Comercial | ✅ Mantém |
| Distribuição | Comercial | Comercial | ✅ Mantém |
| SLA & Breaches | Comercial | Comercial | ✅ Mantém |
| Inteligência Comercial | Comercial | Comercial | ✅ Mantém |
| Aprovações | Comercial | **Gestão** | É ação gerencial, não comercial |
| Lead Status | Comercial | **Configurações** | É configuração de taxonomia |
| Motivos de Perda | Comercial | **Configurações** | É configuração de taxonomia |
| Central WhatsApp | Atendimento | **Conversas** | Merece destaque como seção própria |
| Follow-up WA | Atendimento | **Conversas** | Contexto de conversas |
| Respostas Rápidas | Atendimento | **Configurações** | É configuração de templates |
| Validação | Atendimento | **Operações** | É validação operacional |
| Tarefas & SLA | Atendimento | **Operações** | É controle operacional |
| Gestão de Clientes | Clientes | Clientes | ✅ Mantém |
| Documentação | Clientes | Clientes | ✅ Mantém |
| Avaliações | Clientes | Clientes | ✅ Mantém |
| Agenda Técnica | Clientes | Clientes | ✅ Mantém |
| Instaladores | Operações | Operações | ✅ Mantém (agora com mais itens) |
| Recebimentos | Financeiro | Financeiro | ✅ Mantém |
| Inadimplência | Financeiro | Financeiro | ✅ Mantém |
| Comissões | Financeiro | Financeiro | ✅ Mantém |
| Engenharia Financeira | Financeiro | Financeiro | ✅ Mantém |
| Bancos | Financeiro | Financeiro | ✅ Mantém |
| Vendedores | Cadastros | **Gestão** | Equipe é gestão, não cadastro |
| Usuários & Permissões | Cadastros | **Administração** | Segurança/permissões = admin |
| Equipamentos (Disj/Transf) | Cadastros | **Configurações** | Master data |
| Módulos | Cadastros | **Configurações** | Master data |
| Inversores | Cadastros | **Configurações** | Master data |
| Baterias | Cadastros | **Configurações** | Master data |
| Concessionárias | Cadastros | **Configurações** | Master data |
| Calculadora Solar | Cadastros | **Configurações** | É configuração |
| Gamificação | Cadastros | **Gestão** | Gestão de equipe |
| Copilot IA | IA | IA | ✅ Mantém |
| Instâncias WA | Integrações | Integrações | ✅ Mantém |
| WhatsApp API | Integrações | Integrações | ✅ Mantém |
| Instagram | Integrações | Integrações | ✅ Mantém |
| SolarMarket | Integrações | Integrações | ✅ Mantém |
| Webhooks | Integrações | Integrações | ✅ Mantém |
| Automações | Integrações | Integrações | ✅ Mantém |
| Conteúdo & Visual | Site | Site | ✅ Mantém |
| Serviços | Site | Site | ✅ Mantém |
| Portfólio | Site | Site | ✅ Mantém |
| Auditoria | Administração | Administração | ✅ Mantém |

---

## 4. Comparação Quantitativa

| Métrica | Atual | Proposta |
|---------|-------|---------|
| Total de seções | 11 | 12 |
| Maior seção (itens) | 10 (Comercial) | 9 (Configurações) |
| Seções com 1 item | 3 (Operações, IA, Admin) | 2 (Dashboard, IA) |
| Seções open por default | 4 | 4 |
| Itens acima da dobra (seções abertas) | ~28 | ~18 |

**Redução de 36% nos itens visíveis acima da dobra.**

---

## 5. Ícones e Cores

| Seção | labelIcon | indicatorBg (mantém tokens existentes) |
|-------|-----------|---------------------------------------|
| Dashboard | `BarChart3` | `bg-sidebar-intelligence` |
| Comercial | `TrendingUp` | `bg-sidebar-commercial` |
| Conversas | `MessageCircle` | `bg-sidebar-atendimento` |
| Clientes | `UserCheck` | `bg-sidebar-clients` |
| Operações | `Wrench` | `bg-sidebar-operations` |
| Financeiro | `Wallet` | `bg-sidebar-finance` |
| Gestão | `Users` | `bg-sidebar-cadastros` |
| IA | `Bot` | `bg-sidebar-ai` |
| Integrações | `Cable` | `bg-sidebar-integrations` |
| Site | `Globe` | `bg-sidebar-marketing` |
| Configurações | `Settings` | novo: `bg-sidebar-config` (ou reusar `bg-sidebar-cadastros`) |
| Administração | `Shield` | `bg-sidebar-settings` |

---

## 6. Impacto Zero Garantido

| Aspecto | Status |
|---------|--------|
| Rotas (`/admin/*`) | ❌ Nenhuma alteração |
| IDs dos itens | ❌ Nenhuma alteração |
| Favoritos (persistidos por `id`) | ❌ Nenhuma quebra |
| Drag & Drop | ❌ Mantido (opera sobre `id`) |
| Permissões | ❌ Nenhuma alteração |
| Componentes renderizados | ❌ Nenhuma alteração |

**Único arquivo alterado:** `src/components/admin/sidebar/sidebarConfig.ts`

---

## 7. Aprovação

Aprovar esta proposta para implementação? A mudança é **exclusivamente** na configuração de agrupamento do array `SIDEBAR_SECTIONS`.
