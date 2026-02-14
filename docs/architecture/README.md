# 📐 BASE DE CONHECIMENTO ARQUITETURAL

> **Classificação**: Enterprise Architecture Knowledge Base
> **Versão**: 1.0.0
> **Data**: 2026-02-14
> **Audiência**: Principal Engineers, Staff Engineers, Arquitetos, SREs, Security Engineers
> **Regra**: Este documento é a fonte única de verdade arquitetural. Qualquer decisão que contradiga este documento requer aprovação do board de arquitetura.

---

## Índice

| # | Documento | Conteúdo |
|---|-----------|----------|
| 01 | [Source of Truth](./01_SOURCE_OF_TRUTH.md) | Visão arquitetural, princípios, restrições, trade-offs, decisões tomadas e perigosas |
| 02 | [ADR](./02_ADR.md) | Architectural Decision Records — decisões formais, contexto, alternativas, riscos |
| 03 | [Risk Map](./03_RISK_MAP.md) | Mapa de riscos por severidade (Crítico/Alto/Médio) com mecanismos e gatilhos |
| 04 | [System Limits](./04_SYSTEM_LIMITS.md) | Limites de capacidade, pontos de quebra por escala, gargalos específicos |
| 05 | [Runbook](./05_RUNBOOK.md) | Guias operacionais para cenários de crise |
| 06 | [Tech Debt](./06_TECH_DEBT.md) | Dívida técnica classificada: aceitável, perigosa, proibida |
| 07 | [Immutable Rules](./07_IMMUTABLE_RULES.md) | 12 regras arquiteturais que nunca podem ser violadas |
| 08 | [Maturity](./08_MATURITY.md) | Engineering maturity score e roadmap para elite |

---

## Resumo Executivo

### Score de Maturidade: 5.5/10

### Top 5 Riscos Imediatos (P0)
1. **Leaked password protection desativada** — ativar HOJE
2. **Sentry não configurado** — configurar esta semana
3. **wa_webhook_events com bloat 63:1** — VACUUM FULL esta semana
4. **resolve_public_tenant_id() single-tenant** — corrigir antes do 2º tenant
5. **Zero observabilidade** — implementar este mês

### Capacidade Atual
- **Suporta bem**: ~10 tenants, ~500 usuários, ~5k msgs/dia
- **Limite prático**: ~200 tenants, ~2k usuários concurrent
- **Requer redesenho**: 1000+ tenants

### Decisões Irreversíveis
- Supabase como plataforma (vendor lock-in total)
- Shared-schema multi-tenancy (correto, manter)
- Postgres como fila (funciona hoje, deadline de 1 ano)

### Próximas Ações (por prioridade)
1. Ativar leaked password protection (30 segundos)
2. VACUUM FULL em tabelas com bloat (5 minutos)
3. Configurar Sentry (2 horas)
4. Fix resolve_public_tenant_id (4 horas)
5. Implementar testes de RLS isolation (1 dia)
