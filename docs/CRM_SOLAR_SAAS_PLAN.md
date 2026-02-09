# CRM Solar SaaS — Plano de Módulos

> Auditoria do sistema existente + roadmap de evolução  
> Última atualização: 2026-02-09

---

## 🔍 Auditoria do Estado Atual

### ✅ O que já existe e funciona

| Recurso | Tabelas | Status |
|---------|---------|--------|
| Leads com pipeline de status | `leads`, `lead_status` (7 etapas) | ✅ Funcional |
| Atividades do lead | `lead_atividades` (9 tipos: ligação, whatsapp, visita…) | ✅ Funcional |
| Lead scoring com IA | `lead_scores`, `lead_scoring_config` | ✅ Funcional |
| SLA Rules básico | `sla_rules`, `tasks`, `task_events` | ✅ Parcial |
| Orçamentos vinculados ao lead | `orcamentos` com concessionária | ✅ Funcional |
| Projetos com status enum | `projetos` (8 fases: documentação → concluído) | ✅ Funcional |
| Clientes convertidos | `clientes` com docs e dados técnicos | ✅ Funcional |
| Checklists (cliente + instalador) | `checklists_cliente`, `checklists_instalador` | ✅ Funcional |
| Serviços agendados | `servicos_agendados` com fases e validação | ✅ Funcional |
| Comissões | `comissoes` + `pagamentos_comissao` | ✅ Funcional |
| Financeiro | `recebimentos`, `parcelas`, `pagamentos` | ✅ Funcional |
| WhatsApp Inbox | `wa_conversations`, `wa_messages`, `wa_instances` | ✅ Funcional |
| WhatsApp Automations | `whatsapp_automation_*` | ✅ Funcional |
| Vendedores com código/slug | `vendedores` | ✅ Funcional |
| Multi-tenant | `tenant_id` em todas as tabelas | ✅ Funcional |
| Auditoria | `audit_logs` com 14 triggers | ✅ Funcional |
| SolarMarket Integration | `solar_market_*` | ✅ Funcional |
| Gamificação vendedor | `vendedor_achievements`, `vendedor_metas` | ✅ Funcional |
| Equipamentos | `inversores`, `modulos_fotovoltaicos`, `baterias` | ✅ Funcional |

### ❌ Gaps Identificados (por módulo)

| Módulo | Gap | Impacto |
|--------|-----|---------|
| **1. Distribuição** | `leads.vendedor` é TEXT (nome), não FK para `vendedores` | Sem rastreabilidade de atribuição |
| **1. Distribuição** | Sem regras de distribuição automática (round-robin, por região) | Manual e lento |
| **1. SLA** | Sem tracking de violações de SLA | Sem visibilidade de atrasos |
| **1. SLA** | Sem escalação automática para gerente | Leads abandonados |
| **2. Timeline** | Atividades existem mas não agregam WA/docs/pagamentos | Visão fragmentada |
| **3. Pipeline** | Sem peso de probabilidade por etapa | Sem forecast |
| **3. Pipeline** | Sem motivos de perda obrigatórios | Sem inteligência comercial |
| **3. Pipeline** | Sem valor do deal no pipeline | Sem previsão de receita |
| **5. Financeiro** | Sem dashboard de inadimplência com alertas | Risco financeiro |

---

## 📦 Roadmap de Módulos

### Módulo 1 — Distribuição de Leads + SLA de Atendimento (MVP)

**Objetivo:** Todo lead que entra é distribuído automaticamente e tem SLA de primeiro contato monitorado.

#### Modelos de dados (alterações)

```sql
-- 1. Adicionar vendedor_id (FK) à tabela leads
ALTER TABLE leads ADD COLUMN vendedor_id UUID REFERENCES vendedores(id);

-- 2. Probabilidade por etapa do pipeline (para forecast futuro)
ALTER TABLE lead_status ADD COLUMN probabilidade_peso NUMERIC DEFAULT 0;
ALTER TABLE lead_status ADD COLUMN motivo_perda_obrigatorio BOOLEAN DEFAULT false;

-- 3. Tabela de regras de distribuição
CREATE TABLE lead_distribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'round_robin' | 'manual' | 'regiao' | 'capacidade'
  config JSONB DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Log de distribuições realizadas
CREATE TABLE lead_distribution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id) NOT NULL,
  vendedor_id UUID REFERENCES vendedores(id) NOT NULL,
  rule_id UUID REFERENCES lead_distribution_rules(id),
  motivo TEXT, -- 'round_robin', 'manual', 'regiao_match'
  distribuido_em TIMESTAMPTZ DEFAULT now(),
  distribuido_por UUID -- user_id de quem distribuiu (null = auto)
);

-- 5. Tabela de violações de SLA
CREATE TABLE sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id) NOT NULL,
  sla_rule_id UUID REFERENCES sla_rules(id),
  tipo TEXT NOT NULL, -- 'primeiro_contato' | 'followup' | 'resposta'
  minutos_limite INTEGER NOT NULL,
  minutos_real INTEGER,
  escalado BOOLEAN DEFAULT false,
  escalado_para UUID, -- user_id do gerente
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Motivos de perda
CREATE TABLE motivos_perda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Registro de perda no lead
ALTER TABLE leads ADD COLUMN motivo_perda_id UUID REFERENCES motivos_perda(id);
ALTER TABLE leads ADD COLUMN motivo_perda_obs TEXT;
ALTER TABLE leads ADD COLUMN distribuido_em TIMESTAMPTZ;
```

#### Funcionalidades

- **Distribuição automática round-robin** ao criar lead
- **Redistribuição manual** pelo admin com log
- **Dashboard SLA:** leads sem primeiro contato, leads fora do prazo
- **Alertas visuais:** badge vermelho para leads em breach
- **Escalação:** notificação ao gerente quando SLA é violado

#### Rotas

| Perfil | Rota | Descrição |
|--------|------|-----------|
| Admin/Gerente | `distribuicao` | Config de regras + fila de leads não distribuídos |
| Admin/Gerente | `sla-dashboard` | Visão de violações de SLA + métricas |
| Vendedor | (existente) | Recebe leads automaticamente, vê deadline de SLA |

---

### Módulo 2 — Inbox Multi-canal com Timeline do Cliente (v1)

**Objetivo:** Toda interação (WA, ligação, doc, pagamento) aparece numa timeline unificada por lead/cliente.

#### Modelos de dados

```sql
-- Timeline unificada (view ou tabela materializada)
CREATE TABLE client_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  lead_id UUID REFERENCES leads(id),
  cliente_id UUID REFERENCES clientes(id),
  tipo TEXT NOT NULL, -- 'atividade' | 'wa_message' | 'status_change' | 'documento' | 'pagamento' | 'nota'
  subtipo TEXT, -- 'ligacao', 'visita', 'whatsapp_in', 'whatsapp_out', etc.
  titulo TEXT NOT NULL,
  descricao TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Funcionalidades

- Timeline renderizada no detalhe do lead/cliente
- Notas manuais pelo vendedor (ligação, visita, observação)
- Eventos automáticos via triggers (status change, WA, doc upload, pagamento)
- Filtros por tipo de evento

---

### Módulo 3 — Pipeline Solar com Forecast (v1)

**Objetivo:** Kanban visual com valor estimado e previsão de receita por período.

#### Modelos de dados

```sql
-- Peso por etapa (já no módulo 1)
-- lead_status.probabilidade_peso = 10, 30, 50, 70, 90, 100, 0

-- Valor do deal
ALTER TABLE leads ADD COLUMN valor_estimado NUMERIC;
-- (preenchido pelo orçamento vinculado automaticamente)
```

#### Funcionalidades

- Kanban drag-and-drop com valor por coluna
- Forecast: Σ (valor_estimado × probabilidade_peso) por mês
- Modal de perda obrigatório com `motivo_perda_id`
- Gráficos de funil com taxas de conversão entre etapas

---

### Módulo 4 — Gestão de Projeto/Homologação (v2)

**Objetivo:** Acompanhar o projeto solar desde documentação até comissionamento.

#### Modelos de dados (já existem: `projetos`, `servicos_agendados`, `checklists_instalador`)

Gaps a resolver:
- Adicionar timeline de projeto (sub-etapas de homologação)
- Agenda técnica com calendar view
- Integração com checklist de fotos obrigatórias

---

### Módulo 5 — Financeiro ligado ao Projeto (v2)

**Objetivo:** Recebíveis, inadimplência e comissões vinculados ao ciclo do projeto.

#### Modelos de dados (já existem: `recebimentos`, `parcelas`, `pagamentos`, `comissoes`)

Gaps a resolver:
- Dashboard de inadimplência com aging
- Cálculo automático de comissão ao concluir projeto
- Alertas de parcelas vencidas por vendedor

---

## 🗺️ Menu por Perfil

### Admin / Gerente
```
Dashboard
├── Visão Geral (stats + gráficos)
├── Inteligência Comercial (IA)
├── SLA & Distribuição          ← NOVO M1
│
Leads
├── Pipeline (Kanban)           ← EVOLUÇÃO M3
├── Lista de Leads
├── Distribuição                ← NOVO M1
├── Motivos de Perda            ← NOVO M3
│
Atendimento
├── Inbox WhatsApp              ← EVOLUÇÃO M2
├── Timeline do Cliente         ← NOVO M2
│
Projetos
├── Em Andamento
├── Agenda Técnica              ← NOVO M4
├── Checklists
│
Financeiro
├── Recebimentos
├── Inadimplência               ← NOVO M5
├── Comissões
│
Configurações
├── Equipe (Vendedores)
├── SLA Rules                   ← NOVO M1
├── Distribuição Config         ← NOVO M1
├── Equipamentos
├── SolarMarket
```

### Vendedor
```
Meu Dashboard
├── Leads do Dia (SLA deadline)  ← EVOLUÇÃO M1
├── Follow-ups Pendentes
├── Metas & Gamificação
│
Meus Leads
├── Pipeline Pessoal             ← EVOLUÇÃO M3
├── Lista
│
Atendimento
├── Meu WhatsApp
├── Timeline do Lead             ← NOVO M2
│
Agenda
├── Visitas e Reuniões
```

### Financeiro
```
Dashboard Financeiro
├── Recebimentos
├── Parcelas & Inadimplência     ← EVOLUÇÃO M5
├── Comissões
├── Relatórios
```

### Instalador
```
Meus Serviços
├── Agenda
├── Checklist de Instalação
├── Fotos & Vídeos
```

---

## 📊 Dependências entre Módulos

```
M1 (Distribuição + SLA) ──→ M2 (Timeline) ──→ M3 (Forecast)
                                               ↓
                              M4 (Projetos) ──→ M5 (Financeiro)
```

- **M1 é independente** — pode ser implementado agora
- **M2 depende de M1** — timeline precisa do vendedor_id no lead
- **M3 depende de M1** — forecast usa probabilidade_peso do lead_status
- **M4 é semi-independente** — evolui o que já existe
- **M5 depende de M4** — financeiro ligado ao ciclo do projeto

---

## 🏷️ Fases de Entrega

| Fase | Módulos | Estimativa |
|------|---------|-----------|
| **MVP** | M1: Distribuição + SLA | Sprint atual |
| **v1** | M2: Timeline + M3: Pipeline Forecast | Próximo sprint |
| **v2** | M4: Gestão Projeto + M5: Financeiro | Sprint seguinte |
