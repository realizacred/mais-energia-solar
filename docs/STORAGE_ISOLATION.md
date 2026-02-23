# 🔒 Storage Isolation — Checklist & Plano de Migração

**Data:** 2026-02-09

---

## RESUMO

Todas as storage policies foram substituídas por versões tenant-scoped.
O path obrigatório para uploads agora é: `{tenant_id}/...rest`

---

## BUCKETS AUDITADOS (11/15)

| Bucket | Público | Policies Tenant-Scoped | Status |
|--------|---------|----------------------|--------|
| `brand-assets` | ✅ | SELECT public, INSERT/UPDATE/DELETE admin+tenant | ✅ |
| `obras-portfolio` | ✅ | SELECT public, INSERT/UPDATE/DELETE admin+tenant | ✅ |
| `wa-attachments` | ✅ | SELECT public, INSERT auth+tenant, DELETE admin+tenant | ✅ |
| `contas-luz` | ❌ | ALL admin+tenant, SELECT/INSERT vendedor+tenant, INSERT anon (UUID check) | ✅ |
| `lead-arquivos` | ❌ | ALL admin+tenant, SELECT vendedor+tenant, INSERT anon (UUID check) | ✅ |
| `documentos-clientes` | ❌ | ALL admin+tenant, SELECT/INSERT vendedor+tenant | ✅ |
| `checklist-assets` | ❌ | ALL admin+tenant, SELECT/INSERT instalador+tenant+user | ✅ |
| `comprovantes` | ❌ | ALL admin+tenant, SELECT/INSERT financeiro+tenant | ✅ |
| `module-datasheets` | ✅ | SELECT public, INSERT/UPDATE auth+tenant, DELETE admin+tenant | ✅ (Phase 10) |
| `projeto-documentos` | ❌ | INSERT/SELECT/DELETE tenant-scoped via get_user_tenant_id() | ✅ |
| `proposal-signatures` | ❌ | SELECT auth, INSERT auth (⚠️ sem tenant path) | ⚠️ TODO |
| `proposta-templates` | ❌ | ALL auth (⚠️ sem tenant path) | ⚠️ TODO |
| `irradiance-source` | ❌ | SELECT/INSERT/UPDATE auth (⚠️ sem tenant path) | ⚠️ TODO |
| `irradiance-artifacts` | ❌ | SELECT auth (⚠️ sem tenant path) | ⚠️ TODO |
| `document-files` | ❌ | Sem policies verificadas | ⚠️ TODO |

---

## CHECKLIST DE TESTES

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Admin upload brand-assets com path `{tid}/logo/...` | ✅ Sucesso |
| 2 | Admin upload brand-assets sem tenant prefix | ❌ Bloqueado |
| 3 | Vendedor upload contas-luz com path `{tid}/uploads/...` | ✅ Sucesso |
| 4 | Vendedor lê contas-luz de outro tenant | ❌ Bloqueado |
| 5 | Anon upload contas-luz com UUID prefix | ✅ Sucesso |
| 6 | Anon upload contas-luz sem UUID prefix | ❌ Bloqueado |
| 7 | Instalador upload checklist com `{tid}/{uid}/...` | ✅ Sucesso |
| 8 | Instalador upload checklist com outro user_id | ❌ Bloqueado |
| 9 | Cross-tenant: admin A lê arquivo de tenant B | ❌ Bloqueado |

---

## PLANO DE MIGRAÇÃO DE ARQUIVOS ANTIGOS

~17 arquivos existentes usam paths sem tenant prefix. Eles **não serão acessíveis** pelas novas policies até serem migrados.

### Script de migração (executar no Supabase SQL Editor com service_role):

```sql
-- Lista arquivos que precisam de migração (sem tenant prefix)
SELECT bucket_id, name, created_at
FROM storage.objects
WHERE bucket_id IN ('brand-assets','contas-luz','documentos-clientes','obras-portfolio','wa-attachments','checklist-assets','comprovantes','lead-arquivos')
AND (storage.foldername(name))[1] != '00000000-0000-0000-0000-000000000001'
ORDER BY bucket_id, name;
```

### Migração via Supabase Storage API (Node.js script):

```javascript
// Para cada arquivo antigo:
// 1. Download com service_role
// 2. Re-upload com novo path: {tenant_id}/{old_path}
// 3. Atualizar referências no banco (urls em clientes, leads, etc)
// 4. Deletar arquivo antigo
```

### Rollback:
- As policies antigas podem ser restauradas revertendo a migration
- Os arquivos originais permanecem no storage até serem deletados manualmente

---

## COMPONENTES ATUALIZADOS

| Componente | Bucket | Path Antigo | Path Novo |
|-----------|--------|-------------|-----------|
| `FileUpload` | contas-luz | `uploads/{ts}.ext` | `{tid}/uploads/{ts}.ext` |
| `FileUploadOffline` | contas-luz | `uploads/{ts}.ext` | `{tid}/uploads/{ts}.ext` |
| `BrandLogoUpload` | brand-assets | `{folder}/{ts}.ext` | `{tid}/{folder}/{ts}.ext` |
| `SiteBannersManager` | brand-assets | `banners/{ts}.ext` | `{tid}/banners/{ts}.ext` |
| `ClienteDocumentUpload` | documentos-clientes | `{clienteId}/...` | `{tid}/{clienteId}/...` |
| `ObrasManager` | obras-portfolio | `{uuid}.ext` | `{tid}/{uuid}.ext` |
| `ChatMediaComposer` | wa-attachments | `{uid}/{convId}/...` | `{tid}/{uid}/{convId}/...` |
| `WaInbox` | wa-attachments | `{convId}/{ts}.ext` | `{tid}/{convId}/{ts}.ext` |
| `WaQuickRepliesManager` | wa-attachments | `quick-replies/...` | `{tid}/quick-replies/...` |
| `VideoCapture` | checklist-assets | `{uid}/{svcId}/...` | `{tid}/{uid}/{svcId}/...` |
| `ServicoEmAndamento` | checklist-assets | `{uid}/{svcId}/...` | `{tid}/{uid}/{svcId}/...` |
| `useOfflineSync` | checklist-assets | `{path}` | `{tid}/{path}` |
| `useOfflineChecklistDb` | dynamic | `{path}` | `{tid}/{path}` |

---

## UTILITÁRIO CRIADO

`src/lib/storagePaths.ts` — Funções auxiliares:
- `tenantPath(tenantId, ...segments)` — Constrói path com prefixo tenant
- `getCurrentTenantId()` — Resolve tenant do usuário autenticado (com cache)
- `buildStoragePath(...segments)` — Atalho para path autenticado
- `resolvePublicTenantId(vendedorCode?)` — Resolve tenant para uploads anônimos
- `clearTenantCache()` — Limpa cache (usar em auth state change)
