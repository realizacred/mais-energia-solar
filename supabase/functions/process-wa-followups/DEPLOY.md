# process-wa-followups — Deploy Checklist & Hardening

## Deploy Checklist

- [ ] Confirmar que `supabase/functions/process-wa-followups/` contém **apenas** `index.ts`
- [ ] Nenhum arquivo de teste dentro da pasta (bundle inflation)
- [ ] Import com versão pinada (ex: `@2.49.4`, nunca `@2` ou `@latest`)
- [ ] Deploy via Lovable ou `supabase functions deploy process-wa-followups`
- [ ] Validar resposta 200 com `curl` pós-deploy
- [ ] Verificar logs: campos `backlog`, `alarms`, `timing` presentes
- [ ] Confirmar `total_ms < 45000` em execução real

## Rollback

1. Reverter `index.ts` para versão anterior via Git/History
2. Re-deploy: `supabase functions deploy process-wa-followups`
3. Verificar logs para confirmar rollback

## ⚠️ P0 Hardening: Migrar import para npm: (sem HTTP remoto)

**Status**: PENDENTE  
**Risco**: Import via `esm.sh` depende de CDN externo no bundle time.  
**Meta**: Trocar para `npm:@supabase/supabase-js@2.49.4` com `deno.json` import map + lockfile.  

**Blocker atual**: Bundle timeout com `npm:` — provável causa é tamanho do arquivo (558 linhas).  
**Plano**:
1. Criar `supabase/functions/deno.json` com import map centralizado
2. Gerar `deno.lock` com `deno cache`
3. Testar bundle com `supabase functions serve` local antes de deploy
4. Se timeout persistir, investigar split do arquivo ou flag `--no-verify-jwt` no config.toml

## Smoke Test (fora do bundle)

O smoke test deve ficar em `supabase/tests/process-wa-followups.test.ts` (fora de `functions/`).  
Rodar via CI ou manualmente:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  deno test --allow-net --allow-env supabase/tests/process-wa-followups.test.ts
```
