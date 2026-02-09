# Arquitetura SaaS Multi-Tenant

> **Diretriz permanente**: Este projeto é uma plataforma SaaS. Toda decisão de código, banco de dados, UI e infraestrutura DEVE considerar o contexto multi-tenant.

## Princípios Fundamentais

1. **Isolamento de dados**: Toda tabela possui `tenant_id` com RLS obrigatório.
2. **Super Admin (`/super-admin`)**: Painel exclusivo para gestão de empresas (tenants), planos, assinaturas e métricas globais. Acessível apenas com role `super_admin`.
3. **Admin por tenant (`/admin`)**: Cada empresa tem seu próprio painel administrativo isolado.
4. **Billing**: Sistema de planos (Free, Starter, Pro, Enterprise) com cotas (`plan_limits`), contadores de uso (`usage_counters`) e validação via `enforce_limit_or_throw`.
5. **Onboarding de empresa**: Edge Function `create-tenant` cria automaticamente: tenant, usuário admin, profile, role, assinatura, brand_settings e calculadora_config.
6. **Storage**: Caminhos prefixados com `{tenant_id}/` para isolamento via RLS de storage.

## Estrutura de Roles

| Role | Escopo | Acesso |
|------|--------|--------|
| `super_admin` | Global | `/super-admin` — gerencia todos os tenants |
| `admin` | Tenant | `/admin` — gerencia sua empresa |
| `gerente` | Tenant | `/admin` — acesso gerencial |
| `financeiro` | Tenant | `/admin` — acesso financeiro |
| `vendedor` | Tenant | `/vendedor` — portal do vendedor |
| `instalador` | Tenant | `/instalador` — portal do instalador |

## Fluxo de Criação de Empresa

1. Super Admin acessa `/super-admin`
2. Clica em "Nova Empresa"
3. Preenche: nome, slug, plano, email/senha do admin inicial
4. Edge Function `create-tenant` executa toda a criação atomicamente
5. Admin da nova empresa pode logar e configurar seu painel

## Checklist para Novas Features

- [ ] Tabela tem coluna `tenant_id`?
- [ ] RLS policy filtra por `tenant_id`?
- [ ] Inserções resolvem `tenant_id` automaticamente?
- [ ] Limites de plano são verificados (`check_tenant_limit`)?
- [ ] Storage paths usam `buildStoragePath()` de `storagePaths.ts`?
- [ ] UI respeita permissões de role?
