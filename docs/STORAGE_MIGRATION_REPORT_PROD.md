# Storage Migration Report — PRODUÇÃO

**Data:** 2026-02-09  
**Ambiente:** Produção (Live)  
**Nota:** Staging e produção compartilham o mesmo projeto Supabase. A migração executada em staging já atualizou os dados de produção.

## Resumo

| Métrica | Valor |
|---------|-------|
| Total de arquivos migrados | 14 |
| Migrados com sucesso | 14 |
| Órfãos | 0 |
| Falhas | 0 |
| Pendentes | 0 |
| Re-execução `plan` em prod | 0 novos itens (confirmado) |

## Verificação Pós-Migração (Produção)

### Referências no Banco de Dados

Todas as referências confirmadas com prefixo `00000000-0000-0000-0000-000000000001/`:

| Tabela | Campo | Registros | Prefixo OK |
|--------|-------|-----------|------------|
| orcamentos | arquivos_urls | 4 (5 paths) | ✅ |
| brand_settings | logo_url | 1 | ✅ |
| brand_settings | logo_white_url | 1 | ✅ |
| brand_settings | logo_small_url | 1 | ✅ |
| brand_settings | favicon_url | 1 | ✅ |
| obras | imagens_urls | 2 (5 paths) | ✅ |

### Arquivos no Storage

| Bucket | Arquivos com tenant prefix | Arquivos legados (old_path) |
|--------|---------------------------|----------------------------|
| contas-luz | 5 ✅ | 5 (não deletados — fallback) |
| brand-assets | 4 ✅ | 4 (não deletados — fallback) |
| obras-portfolio | 5 ✅ | 5 (não deletados — fallback) |

### Smoke Test Visual

| Tela | Elemento | Status |
|------|----------|--------|
| Site institucional | Logo header | ✅ Confirmado pelo usuário |
| Site institucional | Logo branca footer | ✅ Confirmado pelo usuário |
| Site institucional | Favicon | ✅ Confirmado pelo usuário |
| Galeria de obras | Imagens obras | ✅ Confirmado pelo usuário |
| Admin > Orçamentos | Arquivos anexados | Pendente — requer login admin |

## Arquivos Antigos (Não Deletados)

Os 14 arquivos com paths antigos permanecem nos buckets como fallback:

```
contas-luz/uploads/1770498986253-t3k7l2.png
contas-luz/uploads/1770567970497-clqu.jpg
contas-luz/uploads/1770568551282-k4z0p.png
contas-luz/uploads/1770602074115-ok7p8.jpg
contas-luz/uploads/1770602084597-qwsbnr.jpg
brand-assets/logo/1770562626361.png
brand-assets/logo-white/1770568728671.png
brand-assets/logo-small/1770568741184.png
brand-assets/favicon/1770562667858.png
obras-portfolio/c3bb02fb-1dc1-4143-9724-872998bb85d3.png
obras-portfolio/029fded9-06de-4b3f-b0de-dc3f672fb916.png
obras-portfolio/c3df1aaa-a258-493e-a43a-56f1bc4f7513.png
obras-portfolio/f5655511-6fcd-411c-b544-73ce8b0305e1.png
obras-portfolio/22a32daa-521d-4ed2-8374-d5ed568c7c96.png
```

**Recomendação:** Agendar limpeza após 7 dias de operação estável.

## Auditoria

- Tabela `storage_migration_log`: 14 registros com status `updated`
- Edge Function: `migrate-storage-paths` (com auth re-ativada)
- Relatório staging: `docs/STORAGE_MIGRATION_REPORT.md`

## Conclusão

✅ Migração de storage em produção concluída com sucesso.  
✅ Nenhum arquivo órfão ou falha.  
✅ Smoke test visual aprovado pelo usuário em staging.  
⚠️ Arquivos antigos mantidos como fallback — limpar após 7 dias.
