# 📘 Documentação Técnica Completa — CRM Solar SaaS

> **Versão:** 1.0  
> **Última atualização:** 2026-02-10  
> **URL de Produção:** https://maisenergiasolar.lovable.app  
> **URL de Preview:** https://id-preview--8ad1d575-68ab-40e4-b2ce-a80de07972fe.lovable.app

---

## Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Banco de Dados](#4-estrutura-de-banco-de-dados)
5. [Sistema Multi-Tenant](#5-sistema-multi-tenant)
6. [Roles e Permissões](#6-roles-e-permissões)
7. [Rotas e Páginas](#7-rotas-e-páginas)
8. [Módulos do Sistema](#8-módulos-do-sistema)
9. [Edge Functions (APIs)](#9-edge-functions-apis)
10. [Webhooks](#10-webhooks)
11. [Integrações Externas](#11-integrações-externas)
12. [Automações](#12-automações)
13. [Regras de Negócio](#13-regras-de-negócio)
14. [Segurança](#14-segurança)
15. [Billing e Planos](#15-billing-e-planos)
16. [Componentes Principais](#16-componentes-principais)
17. [Hooks Customizados](#17-hooks-customizados)
18. [Storage e Uploads](#18-storage-e-uploads)
19. [PWA e Offline](#19-pwa-e-offline)
20. [Observabilidade](#20-observabilidade)
21. [Fluxos Principais](#21-fluxos-principais)
22. [Documentação Auxiliar](#22-documentação-auxiliar)

---

## 1. Visão Geral do Sistema

O **CRM Solar SaaS** é uma plataforma multi-tenant completa para empresas de energia solar. O sistema cobre todo o ciclo de vida do cliente — desde a captação do lead até a conclusão da instalação e gestão financeira.

### Funcionalidades Principais

- **CRM de Leads** com pipeline visual (Kanban) e scoring com IA
- **Inbox WhatsApp** integrado via Evolution API com automações
- **Geração de Propostas** com cálculo de payback e financiamento
- **Gestão de Projetos** com checklists de instalação
- **Financeiro** completo com parcelas, inadimplência e comissões
- **Gamificação** de vendedores com metas e achievements
- **Portal do Vendedor** com landing page personalizada
- **Portal do Instalador** com checklist mobile offline-first
- **Super Admin** para gestão global de tenants e planos
- **Integração SolarMarket** para cotação de equipamentos
- **Push Notifications** via Web Push (VAPID)
- **PWA** com suporte offline (IndexedDB)

---

## 2. Arquitetura do Sistema

### Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Landing  │  │  Admin   │  │ Vendedor │  │   Instalador     │ │
│  │  Page     │  │  Panel   │  │  Portal  │  │   Portal (PWA)   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘ │
│       │              │              │                │            │
│       └──────────────┴──────────────┴────────────────┘            │
│                              │                                    │
│                     Supabase Client SDK                           │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Lovable Cloud)                      │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  PostgreSQL  │  │  Auth       │  │  Edge Functions (31)    │  │
│  │  (70+ tables│  │  (Supabase  │  │  (Deno runtime)         │  │
│  │  + RLS)     │  │   GoTrue)   │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                       │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌────────────┴────────────┐  │
│  │  Realtime   │  │  Storage    │  │  Materialized Views     │  │
│  │  (Postgres  │  │  (8 buckets)│  │  (Dashboard cache)      │  │
│  │   Changes)  │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             ┌──────────┐ ┌────────┐ ┌──────────┐
             │ Evolution│ │ Solar  │ │  BCB /   │
             │ API (WA) │ │ Market │ │  ANEEL   │
             └──────────┘ └────────┘ └──────────┘
```

### Padrão Arquitetural

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|-----------------|
| **Apresentação** | React 18 + Tailwind + shadcn/ui | Renderização, estado local, formulários |
| **Estado** | TanStack Query + Supabase Realtime | Cache, sincronização, invalidação |
| **Autenticação** | Supabase Auth (GoTrue) | JWT, sessão, roles |
| **API** | Supabase PostgREST + Edge Functions | CRUD automático + lógica complexa |
| **Banco de dados** | PostgreSQL 15 (Supabase) | Tabelas, RLS, triggers, functions |
| **Storage** | Supabase Storage (S3) | Uploads de arquivos com isolamento por tenant |
| **Mensageria** | Supabase Realtime | WebSocket para updates em tempo real |

---

## 3. Stack Tecnológico

### Frontend

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| React | 18.3 | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Bundler / Dev server |
| Tailwind CSS | 3.x | Estilos utilitários |
| shadcn/ui | Latest | Componentes base (Radix UI) |
| TanStack Query | 5.83 | Cache e sincronização de dados |
| React Router | 6.30 | Roteamento SPA |
| Framer Motion | 12.30 | Animações |
| Recharts | 2.15 | Gráficos e dashboards |
| Zod | 3.25 | Validação de schemas |
| React Hook Form | 7.61 | Gerenciamento de formulários |
| jsPDF | 4.1 | Geração de PDFs (propostas) |
| Dexie | 4.3 | IndexedDB wrapper (offline) |
| Sentry | 10.38 | Monitoramento de erros |

### Backend

| Tecnologia | Uso |
|-----------|-----|
| Supabase (Lovable Cloud) | BaaS completo |
| PostgreSQL 15 | Banco relacional |
| Deno Runtime | Edge Functions |
| PostgREST 14.1 | API REST automática |
| GoTrue | Autenticação |
| Realtime | WebSocket (postgres_changes) |
| Storage (S3) | Armazenamento de arquivos |

### Integrações Externas

| Serviço | Protocolo | Uso |
|---------|-----------|-----|
| Evolution API | REST + Webhook | WhatsApp Business |
| SolarMarket | REST + Webhook | Cotação de equipamentos e propostas |
| BCB (Banco Central) | REST | Taxas de financiamento |
| ANEEL | REST | Tarifas de energia |
| Instagram Graph API | REST | Sincronização de portfólio |
| Web Push (VAPID) | Push API | Notificações push |

---

## 4. Estrutura de Banco de Dados

### Tabelas por Domínio

#### 🏢 Multi-Tenant & Auth (6 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `tenants` | Empresas cadastradas | `id`, `nome`, `slug`, `ativo`, `plano` |
| `profiles` | Perfil estendido do auth.users | `user_id`, `tenant_id`, `nome`, `ativo`, `telefone` |
| `user_roles` | Roles por usuário (N:N) | `user_id`, `role` (enum), `tenant_id` |
| `vendor_invites` | Convites para vendedores | `email`, `token`, `vendedor_id`, `expires_at` |
| `subscriptions` | Assinaturas de planos | `tenant_id`, `plan_id`, `status`, `trial_ends_at` |
| `plans` | Catálogo de planos SaaS | `code`, `name`, `price_monthly` |

#### 📊 CRM — Leads (10 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `leads` | Leads capturados | `nome`, `telefone`, `status_id`, `vendedor_id`, `valor_estimado`, `motivo_perda_id` |
| `lead_status` | Etapas do pipeline (7 padrão) | `nome`, `cor`, `ordem`, `probabilidade_peso`, `motivo_perda_obrigatorio` |
| `lead_atividades` | Atividades do lead (9 tipos) | `lead_id`, `tipo` (enum), `descricao`, `data_agendada` |
| `lead_scores` | Scoring com IA | `lead_id`, `score`, `nivel`, `probabilidade_fechamento` |
| `lead_scoring_config` | Pesos do scoring | `peso_consumo`, `peso_recencia`, `threshold_hot/warm` |
| `lead_distribution_rules` | Regras de distribuição | `tipo` (round_robin/manual/regiao), `config` (JSONB) |
| `lead_distribution_log` | Log de distribuições | `lead_id`, `vendedor_id`, `motivo`, `vendedor_anterior_id` |
| `lead_links` | Vínculos com SolarMarket | `lead_id`, `sm_client_id`, `sm_project_id` |
| `motivos_perda` | Motivos de perda de leads | `nome`, `ativo`, `ordem` |
| `sla_rules` | Regras de SLA | (configurável) |

#### 💼 Orçamentos & Propostas (4 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `orcamentos` | Orçamentos vinculados ao lead | `lead_id`, `orc_code`, `media_consumo`, `concessionaria_id`, `vendedor_id` |
| `propostas` | Propostas geradas (SolarMarket) | `nome`, `potencia_kwp`, `preco_total`, `payback_anos`, `sm_id` |
| `proposta_itens` | Itens da proposta | `proposta_id`, `descricao`, `quantidade`, `valor` |
| `proposta_variaveis` | Variáveis da proposta | `proposta_id`, `key`, `value`, `topic` |

#### 👥 Clientes & Projetos (4 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `clientes` | Clientes convertidos | `nome`, `telefone`, `cpf_cnpj`, `lead_id`, `potencia_kwp`, `valor_projeto` |
| `projetos` | Projetos de instalação | `cliente_id`, `status` (8 fases enum), `potencia_kwp` |
| `servicos_agendados` | Serviços técnicos | `instalador_id`, `tipo` (enum), `status` (enum), `data_agendada` |
| `layouts_solares` | Layouts de painéis | `projeto_id`, `layout_data` (JSONB), `total_modulos` |

#### ✅ Checklists (6 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `checklist_templates` | Templates de checklist |
| `checklist_template_items` | Itens do template |
| `checklists_cliente` | Checklists de cliente (documentos) |
| `checklist_cliente_respostas` | Respostas do checklist do cliente |
| `checklist_cliente_arquivos` | Arquivos do checklist do cliente |
| `checklists_instalador` | Checklists de instalação |
| `checklist_instalador_respostas` | Respostas do instalador |
| `checklist_instalador_arquivos` | Arquivos do instalador |
| `checklists_instalacao` | Checklist simplificado de instalação |

#### 💰 Financeiro (4 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `recebimentos` | Acordos de recebimento | `cliente_id`, `valor_total`, `numero_parcelas`, `forma_pagamento_acordada` |
| `parcelas` | Parcelas de recebimentos | `recebimento_id`, `valor`, `data_vencimento`, `status` |
| `pagamentos` | Pagamentos realizados | `parcela_id`, `valor_pago`, `data_pagamento` |
| `comissoes` | Comissões de vendedores | `vendedor_id`, `valor_comissao`, `percentual_comissao`, `status` |
| `pagamentos_comissao` | Pagamentos de comissões | `comissao_id`, `valor_pago` |

#### 📱 WhatsApp Inbox (12 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `wa_instances` | Instâncias do Evolution API | `evolution_instance_key`, `evolution_api_url`, `vendedor_id`, `status` |
| `wa_conversations` | Conversas | `remote_jid`, `instance_id`, `cliente_nome`, `unread_count`, `assigned_to` |
| `wa_messages` | Mensagens | `conversation_id`, `content`, `direction`, `message_type`, `media_url` |
| `wa_outbox` | Fila de envio | `instance_id`, `remote_jid`, `content`, `status`, `retry_count` |
| `wa_webhook_events` | Eventos do webhook Evolution | `event_type`, `payload`, `processed`, `retry_count` |
| `wa_tags` | Tags para conversas | `nome`, `cor`, `emoji` |
| `wa_conversation_tags` | Tags aplicadas a conversas | `conversation_id`, `tag_id` |
| `wa_quick_replies` | Respostas rápidas | `titulo`, `conteudo`, `categoria`, `media_url` |
| `wa_quick_reply_categories` | Categorias de respostas | `nome`, `cor`, `emoji` |
| `wa_followup_rules` | Regras de follow-up automático | `cenario`, `prazo_minutos`, `mensagem_template`, `envio_automatico` |
| `wa_followup_queue` | Fila de follow-ups | `conversation_id`, `rule_id`, `scheduled_at`, `status` |
| `wa_message_hidden` | Mensagens ocultadas | `message_id`, `user_id` |
| `push_muted_conversations` | Conversas silenciadas | `conversation_id`, `user_id` |

#### 🏗️ Equipamentos (5 tabelas)

| Tabela | Descrição | Colunas Chave |
|--------|-----------|--------------|
| `inversores` | Inversores solares | `fabricante`, `modelo`, `potencia_nominal_w`, `tipo_sistema` (enum) |
| `modulos_fotovoltaicos` | Módulos/Painéis | `fabricante`, `modelo`, `potencia_w`, `eficiencia_percent` |
| `baterias` | Baterias | `fabricante`, `modelo`, `energia_kwh`, `tipo_bateria` |
| `disjuntores` | Disjuntores | `amperagem`, `descricao` |
| `transformadores` | Transformadores | (dados técnicos) |

#### 🏆 Gamificação (5 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `vendedores` | Cadastro de vendedores (`codigo`, `slug`, `user_id`, `percentual_comissao`) |
| `vendedor_achievements` | Conquistas desbloqueadas (8 tipos enum) |
| `vendedor_metas` | Metas mensais individuais |
| `vendedor_metricas` | Métricas mensais (conversão, ticket, tempo) |
| `vendedor_performance_mensal` | Performance consolidada |
| `meta_notifications` | Notificações de metas |
| `gamification_config` | Configuração global de gamificação |

#### ⚡ Configuração Técnica (7 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `concessionarias` | Concessionárias de energia |
| `config_tributaria_estado` | ICMS e isenções por estado |
| `fio_b_escalonamento` | Escalonamento do fio B |
| `calculadora_config` | Config da calculadora solar pública |
| `payback_config` | Config do motor de payback |
| `financiamento_bancos` | Bancos para financiamento |
| `financiamento_api_config` | Config de API de financiamento |

#### 📊 Billing & Uso (4 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `plan_features` | Features booleanas por plano |
| `plan_limits` | Limites numéricos por plano |
| `usage_counters` | Contadores de uso mensal por tenant |
| `usage_events` | Log de eventos de uso |

#### 🔧 Sistema (5 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `audit_logs` | Log de auditoria imutável (14 triggers) |
| `edge_rate_limits` | Rate limiting de edge functions |
| `backfill_audit` | Auditoria de backfill de tenant_id |
| `release_checklists` | Checklists de release |
| `tasks` / `task_events` | Tarefas e eventos de SLA |

#### 🌐 Site Institucional & Marketing (6 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `obras` | Portfólio de obras (fotos, dados técnicos) |
| `brand_settings` | Configuração visual da marca (cores, fontes, logos) |
| `site_settings` | Configurações do site institucional |
| `site_banners` | Banners do site |
| `site_servicos` | Serviços exibidos no site |
| `simulacoes` | Simulações públicas feitas na calculadora |
| `instagram_config` / `instagram_posts` | Integração Instagram |

#### 🔗 SolarMarket (4 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `solar_market_config` | Configuração da integração |
| `solar_market_equipment` | Equipamentos sincronizados |
| `solar_market_integration_requests` | Log de requisições |
| `solar_market_webhook_events` | Eventos de webhook |

#### 🔔 Push Notifications (4 tabelas)

| Tabela | Descrição |
|--------|-----------|
| `push_subscriptions` | Assinaturas push (endpoint, p256dh, auth) |
| `push_preferences` | Preferências por usuário (enabled, quiet hours) |
| `push_sent_log` | Log de pushes enviados |
| `push_muted_conversations` | Conversas silenciadas |

### Enums do Banco

| Enum | Valores |
|------|---------|
| `app_role` | `admin`, `gerente`, `vendedor`, `instalador`, `financeiro`, `super_admin` |
| `atividade_tipo` | `ligacao`, `whatsapp`, `email`, `reuniao`, `visita`, `proposta`, `negociacao`, `anotacao`, `status_change` |
| `projeto_status` | `aguardando_documentacao`, `em_analise`, `aprovado`, `em_instalacao`, `instalado`, `comissionado`, `concluido`, `cancelado` |
| `servico_status` | `agendado`, `em_andamento`, `concluido`, `cancelado`, `reagendado` |
| `servico_tipo` | `instalacao`, `manutencao`, `visita_tecnica`, `suporte` |
| `checklist_cliente_status` | `pendente`, `em_preenchimento`, `enviado`, `em_revisao`, `aprovado`, `reprovado` |
| `checklist_instalador_fase` | `pre_instalacao`, `instalacao_estrutura`, `instalacao_modulos`, `instalacao_eletrica`, `comissionamento`, `pos_instalacao` |
| `checklist_instalador_status` | `agendado`, `em_execucao`, `pausado`, `pendente_correcao`, `finalizado`, `cancelado` |
| `subscription_status` | `trialing`, `active`, `past_due`, `canceled`, `expired` |
| `achievement_type` | `first_conversion`, `fast_responder`, `conversion_streak`, `monthly_champion`, `top_performer`, `consistency_king`, `high_volume`, `perfect_month` |
| `tipo_sistema_inversor` | `ON_GRID`, `HIBRIDO`, `OFF_GRID` |

### Materialized Views (Dashboard Cache)

| View | Dados |
|------|-------|
| `mv_leads_mensal` | Leads por mês (total, kWh, estados, vendedores) |
| `mv_leads_por_estado` | Leads por estado |
| `mv_vendedor_performance` | Performance por vendedor |
| `mv_pipeline_stats` | Stats do pipeline por status |
| `mv_financeiro_resumo` | Resumo financeiro (pendentes, atrasadas, pagas) |

Refresh via `refresh_dashboard_views()`.

---

## 5. Sistema Multi-Tenant

### Princípios

1. **Toda tabela possui `tenant_id`** — coluna obrigatória com FK para `tenants`
2. **RLS obrigatório** — todas as políticas filtram por `tenant_id`
3. **Resolução automática** — triggers `resolve_lead_tenant_id()`, `resolve_orc_tenant_id()`, `resolve_sim_tenant_id()` resolvem o `tenant_id` automaticamente
4. **Storage isolado** — caminhos prefixados com `{tenant_id}/`

### Functions de Tenant

| Function | Descrição |
|----------|-----------|
| `get_user_tenant_id(_user_id)` | Retorna o `tenant_id` do profile do usuário |
| `user_belongs_to_tenant(_tenant_id)` | Verifica se o usuário pertence ao tenant |
| `require_tenant_id(_user_id)` | Retorna tenant_id ou lança erro P0401/P0402 |
| `resolve_public_tenant_id()` | Resolve para single-tenant (forms públicos) |
| `is_super_admin(_user_id)` | Verifica role super_admin |
| `is_admin(_user_id)` | Verifica roles admin/gerente/financeiro |
| `has_role(_user_id, _role)` | Verifica role específica |

### Fluxo de Criação de Empresa

```
Super Admin → /super-admin → "Nova Empresa"
    │
    ▼
Edge Function: create-tenant
    ├── Cria tenant (nome, slug, plano)
    ├── Cria auth.user (email, senha)
    ├── Cria profile (user_id, tenant_id)
    ├── Cria user_role (admin)
    ├── Cria subscription (trial 14 dias)
    ├── Cria brand_settings (padrão)
    └── Cria calculadora_config (padrão)
```

---

## 6. Roles e Permissões

### Hierarquia de Acesso

| Role | Escopo | Painel | Acesso |
|------|--------|--------|--------|
| `super_admin` | **Global** | `/super-admin` | Gerencia todos os tenants, planos, assinaturas |
| `admin` | Tenant | `/admin/*` | Acesso total ao painel do tenant |
| `gerente` | Tenant | `/admin/*` | Acesso gerencial (sem config avançada) |
| `financeiro` | Tenant | `/admin/*` | Acesso ao módulo financeiro |
| `vendedor` | Tenant | `/vendedor` | Portal do vendedor (leads próprios) |
| `instalador` | Tenant | `/instalador` | Portal do instalador (serviços) |

### Controle de Acesso no Frontend

- **`useAuth()`** — Provider central de autenticação
- **Verificação de roles** via `user_roles` com query ao Supabase
- **Realtime access control** — listener para desativação de profile e remoção de roles
- **Redirecionamento automático** — `/portal` redireciona baseado na role

### Controle de Acesso no Backend (RLS)

- Todas as policies usam `get_user_tenant_id()` para filtrar
- Inserts públicos (leads, orçamentos, simulações) usam triggers de resolução
- Super admin bypassa tenant via `is_super_admin()`

---

## 7. Rotas e Páginas

### Rotas Públicas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/` | `Index` | Landing page institucional + formulário de lead |
| `/v/:codigo` | `VendorPage` | Landing page personalizada do vendedor |
| `/calculadora` | `Calculadora` | Calculadora solar pública |
| `/checklist` | `Checklist` | Checklist de cliente (link enviado) |
| `/auth` | `Auth` | Login / Cadastro |
| `/ativar-conta` | `AtivarConta` | Ativação de conta de vendedor |
| `/instalar` | `Instalar` | Página de instalação do PWA |
| `/avaliacao` | `Avaliacao` | Página de avaliação pós-instalação |

### Rotas Autenticadas

| Rota | Componente | Roles | Descrição |
|------|-----------|-------|-----------|
| `/portal` | `PortalSelector` | Todas | Seletor de portal baseado na role |
| `/admin/*` | `Admin` | admin, gerente, financeiro | Painel administrativo completo |
| `/super-admin` | `SuperAdmin` | super_admin | Gestão global de tenants |
| `/vendedor` | `VendedorPortal` | vendedor | Portal do vendedor |
| `/instalador` | `Instalador` | instalador | Portal do instalador |
| `/inbox` | `Inbox` | admin, gerente, vendedor | Inbox WhatsApp (desktop) |
| `/app` | `MessagingApp` | admin, gerente, vendedor | Inbox WhatsApp (mobile/PWA) |
| `/aguardando-aprovacao` | `PendingApproval` | Todas | Tela de aprovação pendente |
| `/app/debug` | `AppDebug` | admin | Debug do app |

### Sub-Rotas do Admin (`/admin/*`)

O painel admin é composto por um layout com sidebar + área de conteúdo. Os componentes são renderizados dinamicamente baseados no item selecionado na sidebar. As seções incluem:

- **Dashboard** — Stats, gráficos, analytics
- **Comercial** — Leads, Pipeline, Propostas, Follow-ups, Distribuição, SLA
- **Conversas** — Inbox WhatsApp, Follow-up WhatsApp
- **Clientes** — Gestão, Documentação, Avaliações, Agenda Técnica
- **Operações** — Instaladores, Validação, Tarefas
- **Financeiro** — Recebimentos, Inadimplência, Comissões
- **Gestão** — Vendedores, Aprovações, Gamificação
- **IA** — Copilot com insights gerados por IA
- **Integrações** — WhatsApp, Instagram, SolarMarket, Webhooks
- **Site** — Conteúdo, Serviços, Portfólio
- **Configurações** — Calculadora, Status, Equipamentos, Concessionárias
- **Administração** — Usuários, Auditoria

---

## 8. Módulos do Sistema

### 8.1. Módulo de Leads

**Tabelas:** `leads`, `lead_status`, `lead_atividades`, `lead_scores`, `lead_scoring_config`, `motivos_perda`

**Componentes:**
- `LeadFormWizard` — Formulário wizard multi-step para captação
- `LeadForm` — Formulário simplificado
- `LeadsPipeline` — Kanban visual drag-and-drop
- `LeadStatusManager` — CRUD de etapas do pipeline

**Funcionalidades:**
- Pipeline com 7 etapas configuráveis (probabilidade peso por etapa)
- Scoring com IA via edge function `lead-scoring`
- Atividades rastreadas (9 tipos: ligação, WhatsApp, visita, etc.)
- Motivos de perda obrigatórios por etapa
- Valor estimado para forecast
- Código automático `CLI-XXXX` via sequence
- Rate limiting: máximo 5 leads/telefone/hora
- Normalização automática de telefone

### 8.2. Módulo de Distribuição de Leads

**Tabelas:** `lead_distribution_rules`, `lead_distribution_log`

**Componentes:**
- `distribution/` — Config de regras + fila

**Funcionalidades:**
- Distribuição automática round-robin
- Redistribuição manual com log
- Log completo com vendedor anterior
- Timestamp de distribuição (`distribuido_em`)
- FK `vendedor_id` para rastreabilidade

### 8.3. Módulo de Orçamentos

**Tabelas:** `orcamentos`, `concessionarias`

**Funcionalidades:**
- Vinculado ao lead (`lead_id`)
- Código automático `ORC-XXXX`
- Dados técnicos: consumo, tipo telhado, rede, concessionária
- Upload de arquivos (contas de luz)
- Regime de compensação e tipo de ligação
- Rate limiting: máximo 10 orçamentos/lead/hora

### 8.4. Módulo de Propostas

**Tabelas (SSOT):** `propostas_nativas`, `proposta_versoes`, `proposta_kits`, `proposta_versao_ucs`

**Engine oficial de geração:** edge function `proposal-generate` (única autorizada).
A renderização de PDF é feita via Gotenberg a partir do template + snapshot da versão.

**Componentes:** wizard `/admin/propostas-nativas/nova`, hooks `usePropostasNativas`, `useProposalGenerate`.

**Regra:** NÃO existe gerador local de PDF (jsPDF) no projeto. Qualquer fluxo
paralelo fora de `propostas_nativas` / `proposta_versoes` / `proposal-generate`
é proibido (ver auditoria do Portal Consultor — Fase 2A).

**Funcionalidades:**
- Versionamento imutável por snapshot
- Variáveis dinâmicas resolvidas no servidor (`resolveProposalVariables`)
- Séries de dados (consumo mensal, geração mensal, economia anual)
- Validade, status e governança via `proposta_versoes`

### 8.5. Módulo de Clientes

**Tabelas:** `clientes`, `projetos`

**Componentes:** `ClientesManager`, `ClienteViewDialog`, `ClienteDocumentUpload`

**Funcionalidades:**
- Conversão de lead para cliente
- Documentação: identidade, comprovante de endereço, beneficiária
- Dados técnicos: potência kWp, número de placas, inversor
- Vinculação com disjuntor e transformador
- Simulação aceita vinculada

### 8.6. Módulo de Projetos & Instalação

**Tabelas:** `projetos`, `servicos_agendados`, `checklists_instalador`, `layouts_solares`

**Componentes:** `ServicosManager`, `InstaladorManager`, `ChecklistsManager`

**Funcionalidades:**
- 8 fases de projeto (aguardando_documentacao → concluído)
- Serviços com 4 tipos (instalação, manutenção, visita técnica, suporte)
- 5 status de serviço (agendado → concluído)
- Checklist de instalação com 6 fases
- Layout solar visual (editor de módulos)
- Validação de serviço pelo supervisor
- Assinaturas digitais (cliente + instalador) via `react-signature-canvas`

### 8.7. Módulo Financeiro

**Tabelas:** `recebimentos`, `parcelas`, `pagamentos`, `comissoes`, `pagamentos_comissao`

**Componentes:** `RecebimentosManager`, `ComissoesManager`, `InadimplenciaDashboard`

**Funcionalidades:**
- Acordo de recebimento com parcelas automáticas
- Status de parcela: pendente, atrasada, paga
- Atualização automática de parcelas atrasadas (`update_parcelas_atrasadas()`)
- Comissões por vendedor com pagamentos parciais
- Dashboard de inadimplência

### 8.8. Módulo WhatsApp Inbox

**Tabelas:** `wa_instances`, `wa_conversations`, `wa_messages`, `wa_outbox`, `wa_webhook_events`, `wa_tags`, `wa_quick_replies`, `wa_followup_rules`, `wa_followup_queue`

**Componentes:** `admin/inbox/`, `admin/wa/`

**Edge Functions:**
- `evolution-webhook` — Recebe eventos do Evolution API
- `process-webhook-events` — Processa eventos em batch
- `send-whatsapp-message` — Envia mensagens
- `process-wa-outbox` — Processa fila de envio
- `process-wa-followups` — Processa follow-ups automáticos
- `send-wa-reaction` — Envia reações a mensagens
- `sync-wa-history` — Sincroniza histórico
- `check-wa-instance-status` — Verifica status da instância
- `sync-wa-profile-pictures` — Sincroniza fotos de perfil

**Funcionalidades:**
- Inbox fullscreen tipo WhatsApp Web
- Mensagens em tempo real via Supabase Realtime
- Envio de texto, mídia (imagem, áudio, vídeo, documento)
- Respostas rápidas com categorias
- Tags coloridas por conversa
- Notas internas (is_internal_note)
- Reply/Quote de mensagens
- Follow-up automático com regras configuráveis
- Silenciamento de conversas (push)
- Vinculação com lead/cliente
- Controle de acesso: `can_access_wa_conversation()`
- Paginação cursor-based (`get_wa_messages()`)

### 8.9. Módulo de Vendedores & Gamificação

**Tabelas:** `vendedores`, `vendedor_achievements`, `vendedor_metas`, `vendedor_metricas`, `vendedor_performance_mensal`, `gamification_config`

**Componentes:** `VendedoresManager`, `GamificacaoConfig`, `VendedorMetasIndividuais`

**Hooks:** `useGamification`, `useVendedorPortal`

**Funcionalidades:**
- Código automático (ex: JOA001) e slug (ex: joao-silva) via triggers
- Landing page personalizada `/v/:codigo`
- 8 tipos de achievements (first_conversion, fast_responder, etc.)
- Metas mensais: orçamentos, conversões, valor
- Métricas: taxa de resposta rápida, tempo médio de fechamento
- Ranking mensal
- Comissão base + bônus por meta atingida
- Criação de conta de usuário via edge function `create-vendedor-user`
- Ativação de conta via edge function `activate-vendor-account`

### 8.10. Módulo do Instalador

**Tabelas:** `checklists_instalacao`, `servicos_agendados`, `instalador_config`, `instalador_metas`, `instalador_performance_mensal`

**Componentes:** `instalador/`

**Funcionalidades:**
- Portal mobile-first (PWA)
- Checklist de instalação offline (IndexedDB)
- Upload de fotos e vídeos
- Assinatura digital
- Metas e performance mensal
- Sincronização automática quando online

### 8.11. Módulo de Calculadora Solar

**Tabelas:** `calculadora_config`, `simulacoes`, `concessionarias`, `config_tributaria_estado`, `fio_b_escalonamento`, `payback_config`

**Componentes:** `calculadora/`, `payback/`

**Hooks:** `usePaybackEngine`

**Funcionalidades:**
- Calculadora pública de economia solar
- Motor de payback com 20+ variáveis
- Config tributária por estado (ICMS, isenção SCEE)
- Escalonamento do fio B
- Financiamento com múltiplos bancos (taxas BCB)
- Gráficos de consumo e economia

### 8.12. Módulo SolarMarket

**Tabelas:** `solar_market_config`, `solar_market_equipment`, `solar_market_integration_requests`, `solar_market_webhook_events`

**Edge Functions:** `solar-market-sync`, `solar-market-webhook`, `solar-market-auth`

**Funcionalidades:**
- Sincronização de equipamentos
- Geração de propostas
- Webhook para receber atualizações
- Autenticação OAuth

### 8.13. Módulo IA

**Tabelas:** `ai_insights`

**Edge Function:** `generate-ai-insights`

**Hook:** `useAiInsights`

**Funcionalidades:**
- Geração de insights comerciais com IA
- Análise de dados do CRM por período
- Recomendações de ação

### 8.14. Módulo Site Institucional

**Tabelas:** `brand_settings`, `site_settings`, `site_banners`, `site_servicos`, `obras`, `instagram_config`, `instagram_posts`

**Componentes:** `SiteSettingsUnified`, `SiteBannersManager`, `SiteServicosManager`, `ObrasManager`, `BrandSettingsManager`

**Funcionalidades:**
- Personalização completa de cores, fontes, logos
- Temas claro/escuro com variáveis CSS dinâmicas
- Banners configuráveis
- Portfólio de obras com fotos e dados técnicos
- Integração Instagram para portfólio automático
- Serviços customizáveis

---

## 9. Edge Functions (APIs)

O sistema possui **31 Edge Functions** Deno, todas com `verify_jwt = false` no config.toml (autenticação verificada internamente).

### Autenticação & Usuários

| Function | Método | Descrição |
|----------|--------|-----------|
| `create-tenant` | POST | Cria tenant + admin user + subscription |
| `create-vendedor-user` | POST | Cria auth.user para vendedor existente |
| `activate-vendor-account` | POST | Ativa conta de vendedor via token de convite |
| `delete-user` | POST | Remove auth.user |
| `update-user-email` | POST | Atualiza email do auth.user |
| `list-users-emails` | GET | Lista emails de auth.users (admin) |

### WhatsApp

| Function | Método | Descrição |
|----------|--------|-----------|
| `evolution-webhook` | POST | Recebe eventos do Evolution API (webhook) |
| `process-webhook-events` | POST | Processa eventos WA em batch |
| `send-whatsapp-message` | POST | Envia mensagem via Evolution API |
| `process-wa-outbox` | POST | Processa fila de envio pendente |
| `process-wa-followups` | POST | Envia follow-ups automáticos agendados |
| `send-wa-reaction` | POST | Envia reação a mensagem |
| `sync-wa-history` | POST | Sincroniza histórico de conversas |
| `sync-wa-profile-pictures` | POST | Sincroniza fotos de perfil |
| `check-wa-instance-status` | POST | Verifica status da instância Evolution |
| `test-evolution-connection` | POST | Testa conexão com Evolution API |
| `process-whatsapp-automations` | POST | Processa automações WA (templates) |

### Integrações

| Function | Método | Descrição |
|----------|--------|-----------|
| `solar-market-sync` | POST | Sincroniza equipamentos e propostas |
| `solar-market-webhook` | POST | Recebe webhook do SolarMarket |
| `solar-market-auth` | POST | Autenticação OAuth SolarMarket |
| `instagram-sync` | POST | Sincroniza posts do Instagram |
| `sync-taxas-bcb` | POST | Sincroniza taxas do Banco Central |
| `sync-tarifas-aneel` | POST | Sincroniza tarifas da ANEEL |

### IA & Analytics

| Function | Método | Descrição |
|----------|--------|-----------|
| `generate-ai-insights` | POST | Gera insights com IA |
| `lead-scoring` | POST | Calcula score do lead com IA |

### Leads

| Function | Método | Descrição |
|----------|--------|-----------|
| `webhook-lead` | POST | Recebe leads de fontes externas |

### Push Notifications

| Function | Método | Descrição |
|----------|--------|-----------|
| `register-push-subscription` | POST | Registra subscription push |
| `send-push-notification` | POST | Envia push notification |
| `generate-vapid-keys` | POST | Gera chaves VAPID |

### ~~Storage~~ (Removidas)

> As edge functions `cleanup-legacy-storage` e `migrate-storage-paths` foram **deletadas** em 2026-02-15 (migrações concluídas).

---

## 10. Webhooks

### Webhooks Recebidos (Inbound)

| Webhook | Edge Function | Origem | Eventos |
|---------|--------------|--------|---------|
| **Evolution API** | `evolution-webhook` | WhatsApp | Mensagens, status de entrega, conexão |
| **SolarMarket** | `solar-market-webhook` | SolarMarket | Propostas, equipamentos, projetos |
| **Lead Externo** | `webhook-lead` | Landing pages, CRMs | Novos leads |

### Processamento de Webhooks

O sistema usa um padrão de **ingest + process**:

1. **Ingest** — O webhook salva o evento raw em tabela (`wa_webhook_events`, `solar_market_webhook_events`)
2. **Process** — Edge function separada processa em batch com retry
3. **Idempotência** — Verificação de `evolution_message_id` para evitar duplicatas
4. **Retry** — `retry_count` com máximo de tentativas
5. **Cleanup** — Eventos processados são removidos após 7 dias (`cleanup_wa_webhook_events()`)

---

## 11. Integrações Externas

### 11.1. Evolution API (WhatsApp)

| Item | Detalhe |
|------|---------|
| **Protocolo** | REST API + Webhook |
| **Secret** | `EVOLUTION_API_KEY` |
| **Tabelas** | `wa_instances` (api_key, evolution_api_url, evolution_instance_key) |
| **Funcionalidades** | Envio/recebimento de mensagens, status de conexão, perfil |
| **Multi-instância** | Suporte a múltiplas instâncias por tenant |

### 11.2. SolarMarket

| Item | Detalhe |
|------|---------|
| **Protocolo** | REST API + Webhook + OAuth |
| **Secret** | `SOLARMARKET_TOKEN` |
| **Tabelas** | `solar_market_config`, `solar_market_equipment` |
| **Funcionalidades** | Cotação de equipamentos, geração de propostas, sincronização |

### 11.3. BCB (Banco Central do Brasil)

| Item | Detalhe |
|------|---------|
| **Protocolo** | REST API (pública) |
| **Edge Function** | `sync-taxas-bcb` |
| **Tabela** | `financiamento_bancos` |
| **Dados** | Taxas de financiamento de bancos |

### 11.4. ANEEL

| Item | Detalhe |
|------|---------|
| **Protocolo** | REST API (pública) |
| **Edge Function** | `sync-tarifas-aneel` |
| **Tabela** | `concessionarias` |
| **Dados** | Tarifas de energia por concessionária |

### 11.5. Instagram Graph API

| Item | Detalhe |
|------|---------|
| **Protocolo** | REST API (OAuth) |
| **Edge Function** | `instagram-sync` |
| **Tabelas** | `instagram_config`, `instagram_posts` |
| **Funcionalidades** | Sincronização de posts para portfólio |

### 11.6. Web Push (VAPID)

| Item | Detalhe |
|------|---------|
| **Protocolo** | Web Push API |
| **Secrets** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **Edge Functions** | `register-push-subscription`, `send-push-notification`, `generate-vapid-keys` |
| **Tabelas** | `push_subscriptions`, `push_preferences`, `push_sent_log` |

---

## 12. Automações

### 12.1. WhatsApp Follow-up Automático

**Tabelas:** `wa_followup_rules`, `wa_followup_queue`  
**Edge Function:** `process-wa-followups`

**Fluxo:**
1. Admin configura regras de follow-up (cenário, prazo, mensagem template)
2. Quando uma conversa fica inativa, o sistema agenda um follow-up na fila
3. Edge function processa a fila e envia mensagens automaticamente
4. Se o cliente responde, o follow-up é marcado como `responded`

**Parâmetros:**
- `prazo_minutos` — Tempo de inatividade para acionar
- `max_tentativas` — Número máximo de follow-ups
- `envio_automatico` — Se envia sem aprovação manual
- `status_conversa` — Em quais status a regra se aplica

### 12.2. WhatsApp Automations (Templates)

**Edge Function:** `process-whatsapp-automations`

**Funcionalidades:**
- Templates de mensagem configuráveis
- Envio automático baseado em eventos (novo lead, status change)
- Variáveis dinâmicas (nome, código, etc.)

### 12.3. Atualização Automática de Parcelas

**Function:** `update_parcelas_atrasadas()`

Atualiza automaticamente parcelas pendentes para "atrasada" quando `data_vencimento < CURRENT_DATE`.

### 12.4. Auditoria Automática

**Function:** `audit_log_trigger_fn()`

14 triggers de auditoria que registram INSERT, UPDATE e DELETE em tabelas críticas. O `audit_logs` é **imutável** — protegido por triggers `prevent_audit_log_update()` e `prevent_audit_log_delete()`.

### 12.5. Geração Automática de Códigos

| Recurso | Padrão | Trigger |
|---------|--------|---------|
| Lead | `CLI-0001` | `generate_lead_code()` |
| Orçamento | `ORC-0001` | `generate_orc_code()` |
| Vendedor código | `JOA001` | `generate_vendedor_codigo()` |
| Vendedor slug | `joao-silva` | `generate_vendedor_codigo()` + `update_vendedor_slug()` |

### 12.6. Normalização de Telefone

Triggers automáticos que normalizam telefones (removem caracteres não-numéricos) em `leads` e `clientes`.

---

## 13. Regras de Negócio

### 13.1. Captação de Leads

1. Leads podem ser criados por:
   - Formulário público (landing page) — anônimo
   - Formulário do vendedor (`/v/:codigo`) — vinculado ao vendedor
   - Webhook externo (`webhook-lead`)
   - Admin manual
2. O `tenant_id` é resolvido automaticamente por trigger:
   - Auth context → profile → tenant
   - Vendedor code → vendedores → tenant
   - Fallback → único tenant ativo
3. Rate limit: 5 leads por telefone por hora
4. Duplicatas: verificação por `telefone_normalized`
5. Código automático: `CLI-XXXX` via sequence

### 13.2. Pipeline de Vendas

1. 7 etapas configuráveis com ordem, cor e peso de probabilidade
2. Probabilidade por etapa (para forecast):
   - Novo Contato: 10% → Qualificado: 30% → Negociação: 50% → Proposta: 70% → Fechamento: 90% → Ganho: 100% → Perdido: 0%
3. Motivo de perda obrigatório (configurável por etapa)
4. Valor estimado por lead para previsão de receita
5. Forecast = Σ(valor_estimado × probabilidade_peso)

### 13.3. Orçamentos

1. Vinculados ao lead (1 lead → N orçamentos)
2. Dados técnicos independentes (podem variar por proposta)
3. Concessionária vinculada
4. Status compartilhado com o pipeline (`status_id`)
5. Rate limit: 10 por lead por hora

### 13.4. Conversão Lead → Cliente

1. Lead com status "Ganho" → converte para cliente
2. Dados migrados: nome, telefone, endereço
3. Dados adicionais: CPF/CNPJ, documentos
4. Projeto criado automaticamente

### 13.5. Fluxo de Projeto

```
aguardando_documentacao → em_analise → aprovado → em_instalacao → instalado → comissionado → concluido
                                                                                                ↓
                                                                                            cancelado
```

### 13.6. Financeiro

1. Recebimento: acordo com valor total + parcelas
2. Parcelas com vencimento + status (pendente/atrasada/paga)
3. Atualização automática de parcelas atrasadas
4. Comissões: % sobre valor base, por mês de referência
5. Pagamentos parciais de comissão

### 13.7. Vendedores

1. Código único automático (3 letras + 3 números)
2. Slug único para landing page
3. Percentual de comissão individual
4. Vinculação com auth.user via `user_id`
5. Convite por email com token expirável
6. Metas mensais: orçamentos, conversões, valor

### 13.8. WhatsApp

1. Multi-instância por tenant
2. Controle de acesso por instância/vendedor
3. Fila de envio com retry automático
4. Follow-up automático baseado em inatividade
5. Notas internas (não enviadas ao cliente)
6. Tags e categorização de conversas
7. Vinculação com lead/cliente

---

## 14. Segurança

### 14.1. Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado. As policies seguem o padrão:

```sql
-- SELECT: usuário vê apenas dados do seu tenant
CREATE POLICY "tenant_isolation_select" ON tabela
FOR SELECT USING (tenant_id = get_user_tenant_id());

-- INSERT: tenant_id é validado
CREATE POLICY "tenant_isolation_insert" ON tabela
FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

-- Leads/Orçamentos públicos: inserts anônimos com validações
CREATE POLICY "rls_leads_insert_public" ON leads
FOR INSERT TO public
WITH CHECK (tenant_id IS NOT NULL AND nome IS NOT NULL AND ...);
```

### 14.2. Rate Limiting

| Recurso | Limite | Implementação |
|---------|--------|--------------|
| Leads por telefone | 5/hora | Trigger `check_lead_rate_limit()` |
| Orçamentos por lead | 10/hora | Trigger `check_orcamento_rate_limit()` |
| Simulações globais | 50/5min | Trigger `check_simulacao_rate_limit()` |
| Edge functions | 30/min | `check_rate_limit()` function |

### 14.3. Autenticação

- Supabase Auth (GoTrue) com JWT
- Verificação de profile ativo + roles no login
- Realtime listener para desativação de profile
- Realtime listener para remoção de roles
- Logout automático com mensagem de motivo

### 14.4. Auditoria

- `audit_logs` imutável (14 triggers)
- Proteção contra UPDATE e DELETE em audit_logs
- Guard contra INSERT direto (apenas via triggers)
- Captura de `user_id`, `user_email`, dados anteriores e novos

### 14.5. Storage

- Caminhos prefixados com `{tenant_id}/`
- RLS policies no storage via `storage.foldername(name)`
- Buckets privados por padrão (exceto `brand-assets`, `obras-portfolio`, `wa-attachments`)

### 14.6. Secrets

| Secret | Uso |
|--------|-----|
| `SUPABASE_URL` | URL do Supabase |
| `SUPABASE_ANON_KEY` | Chave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin (edge functions) |
| `SUPABASE_DB_URL` | URL direta do banco |
| `EVOLUTION_API_KEY` | Autenticação Evolution API |
| `SOLARMARKET_TOKEN` | Token SolarMarket |
| `VAPID_PUBLIC_KEY` | Chave pública push |
| `VAPID_PRIVATE_KEY` | Chave privada push |
| `LOVABLE_API_KEY` | API interna Lovable |

---

## 15. Billing e Planos

### Planos Disponíveis

| Plano | Preço/mês | Usuários | Leads/mês | WA msgs/mês | Automações |
|-------|-----------|----------|-----------|-------------|-----------|
| **FREE** | R$ 0 | 2 | 50 | 0 | 0 |
| **STARTER** | R$ 197 | 5 | 300 | 500 | 5 |
| **PRO** | R$ 497 | 15 | 1.000 | 3.000 | 20 |
| **ENTERPRISE** | R$ 997 | 50 | 10.000 | 20.000 | 100 |

### Features por Plano

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---------|------|---------|-----|-----------|
| WhatsApp Automation | ❌ | ✅ | ✅ | ✅ |
| AI Insights | ❌ | ❌ | ✅ | ✅ |
| Advanced Reports | ❌ | ❌ | ✅ | ✅ |
| Gamificação | ❌ | ✅ | ✅ | ✅ |
| SolarMarket | ❌ | ✅ | ✅ | ✅ |
| Multi Instance WA | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ | ✅ |
| White Label | ❌ | ❌ | ❌ | ✅ |

### Functions de Billing

| Function | Descrição |
|----------|-----------|
| `get_tenant_subscription()` | Retorna subscription + plan do tenant |
| `check_tenant_limit(metric, delta)` | Verifica se pode consumir mais |
| `increment_usage(metric, delta, source)` | Incrementa contador de uso |
| `enforce_limit_or_throw(metric, delta)` | Verifica e lança erro P0450 |

### Hook Frontend

```tsx
const { subscription, features, limits, hasFeature, checkLimit, enforceLimit } = useTenantPlan();
```

---

## 16. Componentes Principais

### Estrutura de Diretórios

```
src/components/
├── admin/              # Painel administrativo (50+ componentes)
│   ├── analytics/      # Dashboards e gráficos
│   ├── comissoes/      # Gestão de comissões
│   ├── director/       # Visão gerencial
│   ├── distribution/   # Distribuição de leads
│   ├── engenharia/     # Engenharia financeira
│   ├── equipamentos/   # Inversores, módulos, baterias
│   ├── inbox/          # Inbox WhatsApp
│   ├── intelligence/   # IA e insights
│   ├── leads/          # Gestão de leads
│   ├── pipeline/       # Pipeline kanban
│   ├── propostas/      # Propostas
│   ├── recebimentos/   # Recebimentos e parcelas
│   ├── servicos/       # Serviços agendados
│   ├── sidebar/        # Sidebar config e navegação
│   ├── solarmarket/    # Integração SolarMarket
│   ├── stats/          # Widgets de estatísticas
│   ├── tasks/          # Tarefas e SLA
│   ├── users/          # Gestão de usuários
│   ├── views/          # Views do admin
│   ├── wa/             # Config WhatsApp
│   └── widgets/        # Widgets reutilizáveis
├── auth/               # Componentes de autenticação
├── calculadora/        # Calculadora solar
├── checklist/          # Checklists
├── form/               # Componentes de formulário
├── home/               # Landing page
├── instalador/         # Portal do instalador
├── institutional/      # Seções do site
├── layout/             # Layout geral
├── leads/              # Componentes de leads
├── notifications/      # Push notifications
├── payback/            # Calculadora de payback
├── plan/               # Componentes de billing
├── pwa/                # PWA install prompts
├── solar-editor/       # Editor de layout solar
├── ui-kit/             # Design system customizado
├── ui/                 # shadcn/ui base
├── vendor/             # Portal do vendedor
└── wizard/             # Wizard multi-step
```

### Componentes Raiz

| Componente | Descrição |
|-----------|-----------|
| `BrandSettingsProvider` | Provider que aplica cores/fontes do tenant via CSS vars |
| `LeadFormWizard` | Formulário wizard 4 steps com validação e offline fallback |
| `WhatsAppButton` | Botão flutuante de WhatsApp |
| `ConsumptionChart` | Gráfico de consumo energético |
| `FinancingSimulator` | Simulador de financiamento |
| `ProjectGallery` | Galeria de projetos/obras |
| `TestimonialsSection` | Depoimentos de clientes |
| `FileUpload` / `FileUploadOffline` | Upload de arquivos com suporte offline |

---

## 17. Hooks Customizados

### Autenticação & Contexto

| Hook | Descrição |
|------|-----------|
| `useAuth()` | Contexto de autenticação (user, session, signIn, signOut) |
| `useBrandSettings()` | Configurações de marca do tenant |
| `useSiteSettings()` | Configurações do site |
| `useTenantPlan()` | Plano, features e limites do tenant |

### Dados & Queries

| Hook | Descrição |
|------|-----------|
| `useLeads()` | CRUD de leads com cache |
| `useOrcamentos()` | CRUD de orçamentos |
| `useOrcamentosAdmin()` | Orçamentos para admin |
| `useOrcamentosVendedor()` | Orçamentos para vendedor |
| `useGroupedOrcamentos()` | Orçamentos agrupados por lead |
| `usePropostas()` | Gestão de propostas |
| `useDashboardStats()` | Stats do dashboard |
| `useAdvancedMetrics()` | Métricas avançadas |
| `useAiInsights()` | Insights de IA |
| `useLeadScoring()` | Scoring de leads |
| `useDistribution()` | Distribuição de leads |
| `useGamification()` | Dados de gamificação |
| `useVendedorPortal()` | Dados do portal do vendedor |
| `useTasks()` | Tarefas e SLA |
| `usePendingValidations()` | Validações pendentes |

### WhatsApp

| Hook | Descrição |
|------|-----------|
| `useWaInbox()` | Estado e ações do inbox |
| `useWaInstances()` | Gestão de instâncias |
| `useWaNotifications()` | Notificações de mensagens |
| `useNotificationSound()` | Som de notificação |

### Infra & UX

| Hook | Descrição |
|------|-----------|
| `usePaginatedQuery()` | Paginação genérica com TanStack Query |
| `useFormAutoSave()` | Auto-save de formulários |
| `useFormRateLimit()` | Rate limiting no frontend |
| `useHoneypot()` | Honeypot anti-bot |
| `useCidadesPorEstado()` | Cidades por estado (IBGE) |
| `useLogo()` | Logo dinâmico (light/dark) |
| `useSidebarPreferences()` | Preferências de sidebar (drag, favoritos) |
| `useScrollReveal()` | Animações de scroll |
| `use-mobile()` | Detecção de mobile |

### Offline & PWA

| Hook | Descrição |
|------|-----------|
| `useOfflineLeadDb()` | IndexedDB para leads offline |
| `useOfflineLeadSync()` | Sincronização de leads offline |
| `useOfflineChecklistDb()` | IndexedDB para checklists |
| `useOfflineConversionSync()` | Sync de conversões offline |
| `useOfflineSync()` | Sync geral offline |
| `useBackgroundSync()` | Background sync |
| `usePWAInstall()` | Prompt de instalação PWA |
| `usePushNotifications()` | Push notifications |
| `useWebPushSubscription()` | Gerenciamento de subscription push |

---

## 18. Storage e Uploads

### Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `lead-arquivos` | ❌ | Arquivos de leads (contas de luz) |
| `contas-luz` | ❌ | Contas de luz (upload) |
| `documentos-clientes` | ❌ | Documentos de clientes |
| `comprovantes` | ❌ | Comprovantes de pagamento |
| `checklist-assets` | ❌ | Fotos de checklists |
| `brand-assets` | ✅ | Logos e assets da marca |
| `obras-portfolio` | ✅ | Fotos de obras (portfólio público) |
| `wa-attachments` | ✅ | Anexos de WhatsApp |

### Isolamento por Tenant

Todos os uploads usam o padrão `{tenant_id}/...`:

```typescript
// src/lib/storagePaths.ts
buildStoragePath("contas-luz", `uploads/${Date.now()}.jpg`)
// → "00000000-0000-0000-0000-000000000001/uploads/1234567890.jpg"
```

Para uploads anônimos, `resolvePublicTenantId()` resolve via vendedor code ou single-tenant.

---

## 19. PWA e Offline

### Configuração PWA

- **vite-plugin-pwa** para Service Worker
- **Dexie (IndexedDB)** para persistência offline
- Prompt de instalação customizado
- Redirecionamento automático no modo standalone

### Funcionalidades Offline

| Recurso | Implementação |
|---------|--------------|
| Cadastro de leads | `useOfflineLeadDb()` + IndexedDB |
| Checklists de instalação | `useOfflineChecklistDb()` + IndexedDB |
| Conversão de leads | `useOfflineConversionSync()` |
| Upload de fotos | `FileUploadOffline` |
| Sincronização | `useBackgroundSync()` — sync automático quando online |

### Fluxo Offline

```
1. Usuário submete formulário offline
2. Dados salvos no IndexedDB (Dexie)
3. Toast: "Salvo localmente. Será sincronizado quando a conexão voltar."
4. Quando online: background sync envia ao Supabase
5. Dados removidos do IndexedDB após sync bem-sucedido
```

---

## 20. Observabilidade

### Sentry

- **SDK:** `@sentry/react` v10.38
- **Configuração:** `src/lib/sentry.ts`
- **Error Boundary** automático
- Breadcrumbs para contexto de navegação
- Filtragem de erros ignorados (network, JWT expired)

### Error Handler Centralizado

`src/lib/errorHandler.ts` — centraliza tratamento de erros:

- Extração de mensagem, código e status
- Mapeamento para mensagem em PT-BR
- Report ao Sentry (com filtro de noise)
- Console logging para dev
- Handlers especializados: `handleSupabaseError()`, `handleEdgeFunctionError()`, `handleFetchError()`

### Materialized Views para Dashboard

Evita queries pesadas repetidas:
- 5 materialized views cacheadas
- Refresh via `refresh_dashboard_views()`
- Dashboard lê das views, não das tabelas base

### Rate Limit Monitoring

- `edge_rate_limits` com cleanup automático
- `check_rate_limit()` function reutilizável

---

## 21. Fluxos Principais

### 21.1. Captação de Lead (Público)

```
Visitante acessa landing page (/ ou /v/:codigo)
    │
    ├── Preenche formulário wizard (4 steps)
    │   ├── Step 1: Dados pessoais (nome, telefone, CEP)
    │   ├── Step 2: Endereço (auto-complete via CEP)
    │   ├── Step 3: Dados técnicos (consumo, telhado, rede)
    │   └── Step 4: Upload de conta de luz + observações
    │
    ├── Validações frontend (Zod + rate limit + honeypot)
    │
    ├── [ONLINE] Submete ao Supabase
    │   ├── Trigger: normalize telefone
    │   ├── Trigger: rate limit check
    │   ├── Trigger: resolve tenant_id
    │   ├── Trigger: generate lead_code
    │   ├── Trigger: audit log
    │   └── RLS: validates insert
    │
    └── [OFFLINE] Salva em IndexedDB
        └── Sync automático quando online
```

### 21.2. Fluxo de Venda Completo

```
Lead captado (CLI-0001)
    │
    ▼
Distribuição automática → Vendedor atribuído
    │
    ▼
Vendedor contata → Atividade registrada (ligação/WA)
    │
    ▼
Orçamento gerado (ORC-0001)
    │
    ▼
Proposta via SolarMarket → PDF gerado
    │
    ▼
Negociação → Pipeline atualizado
    │
    ▼
Fechamento → Lead status "Ganho"
    │
    ▼
Conversão → Cliente criado + Projeto criado
    │
    ▼
Documentação → Checklist do cliente
    │
    ▼
Aprovação → Projeto aprovado
    │
    ▼
Instalação → Serviço agendado + Checklist do instalador
    │
    ▼
Comissionamento → Teste e validação
    │
    ▼
Conclusão → Recebimento financeiro + Comissão do vendedor
```

### 21.3. Fluxo WhatsApp

```
Cliente envia mensagem (WhatsApp)
    │
    ▼
Evolution API recebe → Webhook para edge function
    │
    ▼
evolution-webhook → Salva em wa_webhook_events
    │
    ▼
process-webhook-events → 
    ├── Cria/atualiza wa_conversation
    ├── Cria wa_message
    ├── Atualiza last_message_at, unread_count
    └── Envia push notification (se habilitado)
    │
    ▼
Realtime → Inbox atualiza em tempo real
    │
    ▼
Vendedor responde → wa_outbox
    │
    ▼
process-wa-outbox → Evolution API → WhatsApp
    │
    ▼
[Se inativo] wa_followup_queue → process-wa-followups → Follow-up automático
```

### 21.4. Fluxo de Onboarding de Empresa

```
Super Admin → /super-admin → "Nova Empresa"
    │
    ▼
Preenche: nome, slug, plano, email admin, senha
    │
    ▼
Edge Function: create-tenant
    ├── 1. Cria registro em tenants
    ├── 2. Cria auth.user (email + senha)
    ├── 3. Cria profile (user_id + tenant_id)
    ├── 4. Cria user_role (role: admin)
    ├── 5. Cria subscription (trial 14 dias)
    ├── 6. Cria brand_settings (cores padrão)
    └── 7. Cria calculadora_config (valores padrão)
    │
    ▼
Admin da empresa faz login → /admin
    │
    ▼
Configura:
    ├── Marca (logo, cores, fontes)
    ├── Concessionárias
    ├── Equipamentos
    ├── Vendedores
    ├── WhatsApp (instância Evolution)
    └── Site institucional
```

---

## 22. Documentação Auxiliar

O projeto mantém documentação técnica detalhada no diretório `docs/`:

| Arquivo | Descrição |
|---------|-----------|
| `SAAS_ARCHITECTURE.md` | Princípios multi-tenant e checklist |
| `SAAS_BILLING_CORE.md` | Sistema de planos, limites e billing |
| `SAAS_MENU_ARCHITECTURE.md` | Proposta de reorganização do menu admin |
| `CRM_SOLAR_SAAS_PLAN.md` | Roadmap de módulos (M1-M5) |
| `DESIGN_SYSTEM.md` | Design system e tokens CSS |
| `UI_STYLE_GUIDE.md` | Guia de estilo UI |
| `AUTH_HARDENING.md` | Hardening de autenticação |
| `HARDENING_PLAN.md` | Plano de hardening geral |
| `RATE_LIMITING.md` | Documentação de rate limiting |
| `STORAGE_ISOLATION.md` | Isolamento de storage por tenant |
| `STORAGE_MIGRATION_REPORT.md` | Relatório de migração de storage |
| `PERFORMANCE_REPORT.md` | Relatório de performance |
| `OBSERVABILITY_STATUS.md` | Status de observabilidade |
| `VENDOR_FRICTION_REPORT.md` | Relatório de fricção do vendedor |
| `VENDOR_FRICTION_AUDIT.md` | Auditoria de UX do vendedor |
| `SMOKE_TEST_REPORT.md` | Relatório de smoke tests |

---

## Apêndice A: Database Functions (RPCs)

| Function | Tipo | Descrição |
|----------|------|-----------|
| `get_user_tenant_id` | STABLE | Retorna tenant do usuário |
| `require_tenant_id` | STABLE | Retorna tenant ou lança erro |
| `is_super_admin` | STABLE | Verifica super_admin |
| `is_admin` | STABLE | Verifica admin/gerente/financeiro |
| `has_role` | STABLE | Verifica role específica |
| `user_belongs_to_tenant` | STABLE | Verifica pertencimento ao tenant |
| `get_tenant_subscription` | STABLE | Subscription + plan do tenant |
| `check_tenant_limit` | STABLE | Verifica limite de uso |
| `increment_usage` | VOLATILE | Incrementa uso + log evento |
| `enforce_limit_or_throw` | VOLATILE | Verifica + lança erro P0450 |
| `validate_vendedor_code` | STABLE | Valida código/slug do vendedor |
| `check_phone_duplicate` | VOLATILE | Verifica duplicata de telefone |
| `resolve_phone_to_email` | STABLE | Resolve telefone → email |
| `get_calculator_config` | STABLE | Config da calculadora |
| `get_payback_config` | STABLE | Config do payback |
| `get_active_financing_banks` | STABLE | Bancos ativos para financiamento |
| `get_fio_b_atual` | STABLE | Fio B atual |
| `get_config_tributaria` | STABLE | Config tributária por estado |
| `get_wa_messages` | STABLE | Mensagens WA com cursor pagination |
| `can_access_wa_conversation` | STABLE | Verifica acesso à conversa |
| `check_rate_limit` | VOLATILE | Rate limiting genérico |
| `refresh_dashboard_views` | VOLATILE | Refresh das MVs |
| `update_parcelas_atrasadas` | VOLATILE | Atualiza parcelas vencidas |
| `cleanup_wa_webhook_events` | VOLATILE | Limpa eventos processados |
| `cleanup_edge_rate_limits` | VOLATILE | Limpa rate limits expirados |
| `cleanup_sm_integration_requests` | VOLATILE | Limpa requests SM antigos |

## Apêndice B: Trigger Functions

| Function | Evento | Tabela | Descrição |
|----------|--------|--------|-----------|
| `audit_log_trigger_fn` | INSERT/UPDATE/DELETE | 14 tabelas | Registra auditoria |
| `guard_audit_log_insert` | BEFORE INSERT | audit_logs | Bloqueia insert direto |
| `prevent_audit_log_update` | BEFORE UPDATE | audit_logs | Bloqueia update |
| `prevent_audit_log_delete` | BEFORE DELETE | audit_logs | Bloqueia delete |
| `check_lead_rate_limit` | BEFORE INSERT | leads | Rate limit + normaliza telefone |
| `check_orcamento_rate_limit` | BEFORE INSERT | orcamentos | Rate limit |
| `check_simulacao_rate_limit` | BEFORE INSERT | simulacoes | Rate limit |
| `resolve_lead_tenant_id` | BEFORE INSERT | leads | Resolve tenant_id |
| `resolve_orc_tenant_id` | BEFORE INSERT | orcamentos | Resolve tenant_id |
| `resolve_sim_tenant_id` | BEFORE INSERT | simulacoes | Resolve tenant_id |
| `generate_lead_code` | BEFORE INSERT | leads | Gera CLI-XXXX |
| `generate_orc_code` | BEFORE INSERT | orcamentos | Gera ORC-XXXX |
| `generate_vendedor_codigo` | BEFORE INSERT | vendedores | Gera código + slug |
| `update_vendedor_slug` | BEFORE UPDATE | vendedores | Atualiza slug ao mudar nome |
| `normalize_cliente_telefone` | BEFORE INSERT/UPDATE | clientes | Normaliza telefone |
| `update_updated_at_column` | BEFORE UPDATE | várias | Atualiza timestamp |

---

*Documento gerado em 2026-02-10. Para atualizações, consulte os arquivos de documentação auxiliar em `docs/`.*
