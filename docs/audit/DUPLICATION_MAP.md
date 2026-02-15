# DUPLICATION MAP — Fontes de Verdade Duplicadas

**Data:** 2026-02-14

---

## 1. `tenants` vs `site_settings` — Overlap Detectado

| Campo | `tenants` | `site_settings` | Quem é a verdade? |
|---|---|---|---|
| `cidade` | ✅ | ✅ | 🔴 **DUPLICAÇÃO** |
| `estado` | ✅ | ✅ | 🔴 **DUPLICAÇÃO** |
| `dominio_customizado` | ✅ | ✅ | 🔴 **DUPLICAÇÃO** |
| `created_at` | ✅ | ✅ | OK (metadados independentes) |
| `updated_at` | ✅ | ✅ | OK (metadados independentes) |

### Diagnóstico
- `tenants` contém dados cadastrais da empresa (CNPJ, nome, cidade, estado)
- `site_settings` contém dados do site público (SEO, hero, endereço completo)
- **cidade/estado/dominio_customizado** existem em ambas as tabelas

### Recomendação
- `cidade` e `estado` em `site_settings`: manter (são o endereço comercial exibido no site, pode diferir do cadastro)
- `dominio_customizado`: **🔴 ELIMINAR de `site_settings`** — a fonte de verdade deve ser `tenants.dominio_customizado`
- Criar view ou helper que resolva a partir de `tenants`

## 2. `brand_settings` vs `site_settings` — Separação OK

Não há overlap real:
- `brand_settings` → cores, fontes, logos, temas (design system)
- `site_settings` → conteúdo textual, SEO, redes sociais, hero

**✅ Separação correta.** Cada tabela tem um domínio distinto.

## 3. `SiteConfigManager.tsx` — Componente Duplicado

- `SiteConfigManager.tsx` faz CRUD em `site_settings`
- `SiteSettingsUnified.tsx` faz CRUD em `site_settings` + `brand_settings`
- O componente `SiteConfigManager` **NÃO é importado** por nenhum outro arquivo

**🔴 DELETAR `SiteConfigManager.tsx`** — substituído por `SiteSettingsUnified`.

## 4. `sidebarConfig.ts` vs `navRegistry.ts`

- `sidebarConfig.ts` contém itens hardcoded com ids, titles, icons
- `navRegistry.ts` é a fonte de verdade usada por `useNavConfig()`
- O sidebar é **renderizado a partir do navRegistry**, não do sidebarConfig

**🟡 Fonte de verdade dupla parcial.** O `sidebarConfig.ts` serve como fallback/tipo mas mantém dados que podem divergir do registry.

## 5. `propostas` vs `propostas_nativas` — Design Intencional

- `propostas` (tabela SolarMarket sync) → importações externas
- `propostas_nativas` (tabela nova) → motor nativo com versionamento

**✅ Não é duplicação — são dois sistemas distintos em transição.**

## 6. `links-instalacao` vs `canais-captacao` — **RESOLVIDO ✅**

- `CanaisCaptacaoPage` era um subconjunto de `LinksInstalacaoPage`
- Ambas geravam links `/v/:slug` e `/w/:slug` a partir de `consultores`
- **Ação tomada:** `canais-captacao` removido do navRegistry, rota redireciona para `links-instalacao`
- **Canonical:** `links-instalacao` ("Captação & App")

---

## Score

| Item | Severidade | Ação |
|---|---|---|
| `dominio_customizado` em 2 tabelas | 🔴 P1 | Migrar para single source em `tenants` |
| `SiteConfigManager.tsx` órfão | 🔴 P2 | Deletar |
| `sidebarConfig.ts` redundante | 🟡 P2 | Documentar que navRegistry é truth |
| `canais-captacao` duplicado | ✅ Resolvido | Removido, redireciona para `links-instalacao` |
