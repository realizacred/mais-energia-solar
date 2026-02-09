# Storage Cleanup Report

**Data:** 2026-02-09  
**Ambiente:** Produção (mesmo Supabase)  
**Função:** `cleanup-legacy-storage`  
**Modo:** Dry Run

## Resultado do Dry Run

| Métrica | Valor |
|---------|-------|
| Total analisado | 14 |
| Arquivo antigo encontrado | 14 |
| Arquivo novo verificado | 14 |
| Tamanho idêntico (size_match) | 14 |
| Seguros para deletar | **14** |
| Não seguros | 0 |

## Detalhe por Arquivo

### Bucket: `contas-luz`

| Old Path | New Path | Old Size | New Size | Match | Safe |
|----------|----------|----------|----------|-------|------|
| `uploads/1770498986253-t3k7l2.png` | `00000000-.../uploads/1770498986253-t3k7l2.png` | 172,432 | 172,432 | ✅ | ✅ |
| `uploads/1770567970497-clqu.jpg` | `00000000-.../uploads/1770567970497-clqu.jpg` | 2,260,182 | 2,260,182 | ✅ | ✅ |
| `uploads/1770568551282-k4z0p.png` | `00000000-.../uploads/1770568551282-k4z0p.png` | 10,552 | 10,552 | ✅ | ✅ |
| `uploads/1770602074115-ok7p8.jpg` | `00000000-.../uploads/1770602074115-ok7p8.jpg` | 2,369,841 | 2,369,841 | ✅ | ✅ |
| `uploads/1770602084597-qwsbnr.jpg` | `00000000-.../uploads/1770602084597-qwsbnr.jpg` | 1,882,024 | 1,882,024 | ✅ | ✅ |

### Bucket: `brand-assets`

| Old Path | New Path | Old Size | New Size | Match | Safe |
|----------|----------|----------|----------|-------|------|
| `logo/1770562626361.png` | `00000000-.../logo/1770562626361.png` | 733,878 | 733,878 | ✅ | ✅ |
| `logo-white/1770568728671.png` | `00000000-.../logo-white/1770568728671.png` | 43,057 | 43,057 | ✅ | ✅ |
| `logo-small/1770568741184.png` | `00000000-.../logo-small/1770568741184.png` | 18,413 | 18,413 | ✅ | ✅ |
| `favicon/1770562667858.png` | `00000000-.../favicon/1770562667858.png` | 733,878 | 733,878 | ✅ | ✅ |

### Bucket: `obras-portfolio`

| Old Path | New Path | Old Size | New Size | Match | Safe |
|----------|----------|----------|----------|-------|------|
| `c3bb02fb-...png` | `00000000-.../c3bb02fb-...png` | 385,344 | 385,344 | ✅ | ✅ |
| `029fded9-...png` | `00000000-.../029fded9-...png` | 2,296,960 | 2,296,960 | ✅ | ✅ |
| `c3df1aaa-...png` | `00000000-.../c3df1aaa-...png` | 2,175,006 | 2,175,006 | ✅ | ✅ |
| `f5655511-...png` | `00000000-.../f5655511-...png` | 2,823,812 | 2,823,812 | ✅ | ✅ |
| `22a32daa-...png` | `00000000-.../22a32daa-...png` | 1,489,218 | 1,489,218 | ✅ | ✅ |

## Próximo Passo

**⚠️ AGUARDANDO APROVAÇÃO EXPLÍCITA** para executar `{"action": "delete"}`.

Ao aprovar, os 14 arquivos legados serão removidos e o `storage_migration_log` será atualizado para status `cleaned`.
