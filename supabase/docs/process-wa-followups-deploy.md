# process-wa-followups — Deploy Checklist & Hardening

## Deploy Checklist

- [ ] Confirmar que `supabase/functions/process-wa-followups/` contém **apenas** `index.ts`
- [ ] Nenhum arquivo de teste dentro da pasta (bundle inflation)
- [ ] Deploy via Lovable ou `supabase functions deploy process-wa-followups`
- [ ] Validar resposta 200 com `curl` pós-deploy
- [ ] Verificar logs: campos `backlog`, `alarms`, `timing` presentes
- [ ] Confirmar `total_ms < 45000` em execução real

## Rollback

1. Reverter `index.ts` para versão anterior via Git/History
2. Re-deploy: `supabase functions deploy process-wa-followups`
3. Verificar logs para confirmar rollback

---

## ⚠️ P0 — Dívida Técnica: esm.sh @2 (workaround)

### Situação atual

| Ambiente | Import | Versão | Status |
|----------|--------|--------|--------|
| **Lovable (dev)** | `esm.sh/@supabase/supabase-js@2` | Flutuante | ✅ Funciona (cache do bundler) |
| **Supabase CLI (prod)** | `npm:@supabase/supabase-js@2.49.4` | Exata | 🎯 Meta |

### Por que estamos em esm.sh @2

O bundler do Lovable (esbuild/deno bundle remoto) faz timeout com:
- Versão exata via esm.sh (`@2.49.4`) → cache miss no CDN, redirect lento
- `npm:` specifier → resolução de dependências excede o tempo limite do bundler

A versão flutuante `@2` já está cacheada no CDN do esm.sh, evitando o timeout.

### Riscos

1. **Não reprodutível** — build de hoje ≠ build de amanhã (esm.sh pode atualizar o minor)
2. **Breaking changes silenciosos** — minor/patch do supabase-js pode introduzir bugs
3. **Sem lockfile** — nenhum hash de integridade verificando o conteúdo baixado
4. **Dependência de CDN externo** — se esm.sh cair, deploy falha

### Critério de saída (quando migrar)

Migrar para `npm:` specifier quando **qualquer** condição for verdadeira:
- [ ] Lovable suportar `npm:` specifiers nativamente
- [ ] Bundle time < 30s com `npm:@supabase/supabase-js@2.49.4`
- [ ] Lovable suportar `deno.json` import maps no bundle
- [ ] Deploy passar a ser feito exclusivamente via `supabase functions deploy` (CI)

### Plano de migração esm.sh → npm:

```
Fase 1 (ATUAL): esm.sh @2 no Lovable — funcional, sem pin
Fase 2 (CI):    supabase functions deploy com deno.json import map
Fase 3 (META):  remover esm.sh, usar apenas npm: specifier
```

**Fase 2 — Deploy via CI (produção canônica):**

1. Criar `supabase/functions/deno.json`:
```json
{
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2.49.4"
  }
}
```

2. Alterar import no `index.ts` para:
```ts
import { createClient } from "@supabase/supabase-js";
```

3. Gerar lockfile: `cd supabase/functions && deno cache process-wa-followups/index.ts`

4. Deploy: `supabase functions deploy process-wa-followups`

5. Se timeout: reverter para esm.sh @2 e investigar split do arquivo

**Rollback da migração:**
```bash
# 1. Reverter import para esm.sh
sed -i 's|from "@supabase/supabase-js"|from "https://esm.sh/@supabase/supabase-js@2"|' \
  supabase/functions/process-wa-followups/index.ts

# 2. Re-deploy
supabase functions deploy process-wa-followups
```

---

## 🛡️ Check: Imports sem pin

Detecta imports esm.sh sem versão exata. Dois modos:

```bash
# Dev (Lovable) — apenas avisa sobre @2, não bloqueia
bash supabase/scripts/check-imports-pinned.sh --warn

# CI/Produção — falha se qualquer import não tiver versão exata
bash supabase/scripts/check-imports-pinned.sh --strict
```

**Exemplos de saída:**
```
⚠️  IMPORT SEM PIN EXATO [functions/process-wa-followups/index.ts:1]
    import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
━━━ Resultado ━━━
  Sem versão (crítico): 0
  Versão flutuante:     1
⚠️  1 import(s) com versão flutuante — aceitável em dev (Lovable workaround).
```

**GitHub Actions step:**
```yaml
- name: Check import pins (strict)
  run: bash supabase/scripts/check-imports-pinned.sh --strict
```

---

## 🛡️ Check: Arquivos proibidos em Edge Functions

```bash
# Local
bash supabase/scripts/check-functions-clean.sh

# CI
- name: Check Edge Functions cleanliness
  run: bash supabase/scripts/check-functions-clean.sh
```

---

## Smoke Test (fora do bundle)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  deno test --allow-net --allow-env supabase/tests/process-wa-followups.test.ts
```

---

## Definições

| Termo | Significado |
|-------|-------------|
| **Dev workaround** | `esm.sh @2` — aceito APENAS no Lovable bundler, não é produção canônica |
| **Produção canônica** | `npm:@supabase/supabase-js@2.49.4` via `supabase functions deploy` com lockfile |
| **Build pin** | Versão exata no import OU lockfile com hash de integridade |
