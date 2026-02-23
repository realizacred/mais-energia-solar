# 🚀 CI/CD & Quality Gates

**Data:** 2026-02-23

---

## RESUMO

Este documento descreve os quality gates e processos de deploy do sistema. Como o projeto roda no Lovable (sem GitHub Actions), os gates são executados manualmente ou via scripts.

---

## QUALITY GATES — PRE-DEPLOY

### Gate 1: Testes Unitários
```bash
bun run test
```
**Critério:** 100% dos testes passando (atualmente 94/94).

### Gate 2: Lint
```bash
bun run lint
```
**Critério:** Zero erros. Warnings são aceitáveis mas devem ser revisados.

### Gate 3: Build
```bash
bun run build
```
**Critério:** Build sem erros. Warnings de TypeScript devem ser investigados.

### Gate 4: Edge Functions — Limpeza
```bash
bash supabase/scripts/check-functions-clean.sh
```
**Critério:** Apenas arquivos `.ts` e `deno.json` dentro de `supabase/functions/`.

### Gate 5: Edge Functions — Imports Pinados
```bash
bash supabase/scripts/check-imports-pinned.sh --warn
```
**Critério:** Zero imports sem versão. Versões flutuantes são warnings em dev, erros em prod.

---

## CHECKLIST PRE-DEPLOY

| # | Verificação | Comando/Ação |
|---|---|---|
| 1 | Testes passando | `bun run test` |
| 2 | Build sem erros | `bun run build` |
| 3 | Lint limpo | `bun run lint` |
| 4 | Edge Functions limpas | `check-functions-clean.sh` |
| 5 | Imports pinados | `check-imports-pinned.sh` |
| 6 | Migrations aplicadas | Verificar no Supabase Dashboard |
| 7 | RLS policies revisadas | `supabase db lint` |
| 8 | Secrets configurados | Verificar Edge Functions secrets |
| 9 | Regression checklist | Ver `docs/REGRESSION_CHECKLIST.md` |

---

## SCRIPTS EXISTENTES

| Script | Localização | Função |
|---|---|---|
| `check-functions-clean.sh` | `supabase/scripts/` | Verifica arquivos proibidos em functions/ |
| `check-imports-pinned.sh` | `supabase/scripts/` | Detecta imports esm.sh sem versão exata |
| `staging-anonymize.sql` | `scripts/` | Anonimiza dados para ambiente de staging |

---

## NPM SCRIPTS

| Script | Comando | Uso |
|---|---|---|
| `dev` | `vite` | Desenvolvimento local |
| `build` | `vite build` | Build de produção |
| `build:dev` | `vite build --mode development` | Build dev |
| `lint` | `eslint .` | Linting |
| `test` | `vitest run` | Testes (single run) |
| `test:watch` | `vitest` | Testes (watch mode) |
| `preview` | `vite preview` | Preview do build |

---

## AMBIENTES

| Ambiente | URL | Deploy |
|---|---|---|
| Preview | `id-preview--*.lovable.app` | Automático (cada push) |
| Produção | `maisenergiasolar.lovable.app` | Via "Publish" no Lovable |

---

## PROCESSO DE DEPLOY

```
1. Desenvolver feature/fix
2. Executar quality gates (testes, lint, build)
3. Testar no preview
4. Revisar regression checklist (docs/REGRESSION_CHECKLIST.md)
5. Publish via Lovable
6. Verificar logs de Edge Functions no Dashboard
7. Smoke test em produção (login, criar lead, gerar proposta)
```

---

## MONITORAMENTO PÓS-DEPLOY

- **Sentry**: Erros de frontend capturados via `@sentry/react`
- **Supabase Dashboard**: Logs de Edge Functions, Auth, Postgres
- **Analytics**: Disponíveis via Lovable Dashboard

---

## ROLLBACK

1. **Frontend**: Restaurar versão anterior via Lovable History
2. **Database**: Reverter migration via SQL Editor (scripts de rollback nas migrations)
3. **Edge Functions**: Redeploy da versão anterior

---

## RECOMENDAÇÕES FUTURAS

Quando o projeto migrar para GitHub:

1. **GitHub Actions** — automatizar gates 1-5 em PR checks
2. **Branch protection** — requerer PR review + CI pass
3. **Staging environment** — usar `staging-anonymize.sql` para dados de teste
4. **Supabase CLI** — `supabase db push` para migrations automatizadas
5. **Preview deployments** — branch-based preview URLs
