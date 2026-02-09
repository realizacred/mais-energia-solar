# Storage Migration Report

**Data:** 2026-02-09  
**Ambiente:** Staging/Dev (Test)  
**Executor:** Edge Function `migrate-storage-paths`  
**Tenant:** `00000000-0000-0000-0000-000000000001`

## Resumo

| Métrica | Valor |
|---------|-------|
| Total de arquivos inventariados | 14 |
| Migrados com sucesso | 14 |
| Órfãos | 0 |
| Falhas | 0 |
| Pendentes | 0 |

## Arquivos Migrados

### Bucket: `contas-luz` (5 arquivos)

| Tabela | Registro | Campo | Path Antigo | Path Novo | Status |
|--------|----------|-------|-------------|-----------|--------|
| orcamentos | c4cd76bf-... | arquivos_urls | `uploads/1770498986253-t3k7l2.png` | `00000000-.../uploads/1770498986253-t3k7l2.png` | ✅ updated |
| orcamentos | b8fb59ee-... | arquivos_urls | `uploads/1770567970497-clqu.jpg` | `00000000-.../uploads/1770567970497-clqu.jpg` | ✅ updated |
| orcamentos | 48798bd6-... | arquivos_urls | `uploads/1770568551282-k4z0p.png` | `00000000-.../uploads/1770568551282-k4z0p.png` | ✅ updated |
| orcamentos | 33bacf41-... | arquivos_urls | `uploads/1770602074115-ok7p8.jpg` | `00000000-.../uploads/1770602074115-ok7p8.jpg` | ✅ updated |
| orcamentos | 33bacf41-... | arquivos_urls | `uploads/1770602084597-qwsbnr.jpg` | `00000000-.../uploads/1770602084597-qwsbnr.jpg` | ✅ updated |

### Bucket: `brand-assets` (4 arquivos)

| Tabela | Registro | Campo | Path Antigo | Path Novo | Status |
|--------|----------|-------|-------------|-----------|--------|
| brand_settings | b345269e-... | logo_url | `logo/1770562626361.png` | `00000000-.../logo/1770562626361.png` | ✅ updated |
| brand_settings | b345269e-... | logo_white_url | `logo-white/1770568728671.png` | `00000000-.../logo-white/1770568728671.png` | ✅ updated |
| brand_settings | b345269e-... | logo_small_url | `logo-small/1770568741184.png` | `00000000-.../logo-small/1770568741184.png` | ✅ updated |
| brand_settings | b345269e-... | favicon_url | `favicon/1770562667858.png` | `00000000-.../favicon/1770562667858.png` | ✅ updated |

### Bucket: `obras-portfolio` (5 arquivos)

| Tabela | Registro | Campo | Path Antigo | Path Novo | Status |
|--------|----------|-------|-------------|-----------|--------|
| obras | 60050d22-... | imagens_urls | `c3bb02fb-...png` | `00000000-.../c3bb02fb-...png` | ✅ updated |
| obras | 60050d22-... | imagens_urls | `029fded9-...png` | `00000000-.../029fded9-...png` | ✅ updated |
| obras | 60050d22-... | imagens_urls | `c3df1aaa-...png` | `00000000-.../c3df1aaa-...png` | ✅ updated |
| obras | 60050d22-... | imagens_urls | `f5655511-...png` | `00000000-.../f5655511-...png` | ✅ updated |
| obras | c19af48a-... | imagens_urls | `22a32daa-...png` | `00000000-.../22a32daa-...png` | ✅ updated |

## Buckets Sem Arquivos Legados

| Bucket | Motivo |
|--------|--------|
| `checklist-assets` | Nenhum arquivo encontrado |
| `documentos-clientes` | 1 arquivo encontrado — já com prefixo tenant correto (skip) |
| `lead-arquivos` | Nenhum arquivo encontrado |
| `comprovantes` | Nenhum arquivo encontrado |
| `wa-attachments` | Nenhum arquivo encontrado |

## Arquivo Já Correto (Ignorado)

| Tabela | Campo | Path |
|--------|-------|------|
| clientes | identidade_urls | `0e217aee-af61-4ff4-b40e-88c4bdb1626b/identidade_urls/1770593060417-sitxi.png` |

## Tabelas/Campos Atualizados

| Tabela | Campo | Tipo | Registros Afetados |
|--------|-------|------|-------------------|
| orcamentos | arquivos_urls | text[] | 4 |
| brand_settings | logo_url | text | 1 |
| brand_settings | logo_white_url | text | 1 |
| brand_settings | logo_small_url | text | 1 |
| brand_settings | favicon_url | text | 1 |
| obras | imagens_urls | text[] | 2 |

## Verificação Pós-Migração

- [x] Todos os paths no DB contêm prefixo `{tenant_id}/`
- [x] URLs de brand_settings contêm `/00000000-.../` no path
- [x] URLs de obras contêm `/00000000-.../` no path
- [x] Paths de orcamentos prefixados corretamente
- [x] Nenhum registro remanescente sem prefixo tenant
- [x] `storage_migration_log` registra 14 itens com status `updated`
- [ ] Smoke test visual (logos, obras, contas de luz) — **PENDENTE: requer login**
- [ ] Limpeza dos arquivos antigos (old_path) — **NÃO executar agora**

## Estratégia de Rollback

1. Consultar `storage_migration_log` para reverter referências no DB
2. Os arquivos antigos NÃO foram deletados — permanecem nos buckets originais
3. Para reverter: atualizar DB paths de volta usando `old_path` da tabela de log

## Produção

**Status: NÃO executar em produção ainda.**

Pré-requisitos para produção:
1. Smoke test visual completo em staging (com login)
2. Verificar que logos/imagens carregam corretamente nas telas
3. Validar downloads de contas de luz nos orçamentos
4. Somente após aprovação: executar `migrate-storage-paths` com `action: plan` + `execute` em produção
5. Após confirmação: agendar limpeza dos arquivos antigos (old_path)

## Auditoria

Tabela `storage_migration_log` contém registro completo com:
- `bucket`, `old_path`, `new_path`
- `tabela`, `registro_id`, `campo`
- `tenant_id`, `status`, `error`, `migrated_at`
