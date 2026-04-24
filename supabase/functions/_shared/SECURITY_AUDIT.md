# Auditoria de Segurança — Edge Functions

Tracking de vulnerabilidades de ownership/tenant validation.

## ✅ Corrigidas

| Edge | Vulnerabilidade | PR | Data |
|---|---|---|---|
| sm-criar-pipeline-auto | tenantId vinha do body sem validar JWT | PR-1 | 2026-04-24 |

## 🔴 Suspeitas (a investigar no PR-2)

| Edge | Sintoma | Origem do alerta |
|---|---|---|
| meta-ads-sync | Build error: "tenantId fora de escopo" linhas 252,256 | Baseline do PR-1 |

## 🟡 Outras edges com erros de build pré-existentes (não-segurança)

- instagram-sync (SDK desatualizado, linha 32)
- integration-health-check (enum mismatch, linha 431)
- monitor-alert-engine (tipagem Postgrest, 6 erros)
- monitoring-connect (Deno Uint8Array, linhas 32,38)
