# 🔐 AUTH HARDENING — Relatório de Verificação

**Data:** 2026-02-09  
**Projeto:** bguhckqkpnziykpbwbeu  
**Status:** ⏳ PENDENTE AÇÕES DO ADMINISTRADOR

---

## CHECKLIST DE SEGURANÇA AUTH

### 1. ✅ Leaked Password Protection

**O que é:** Verifica senhas contra bases de dados de senhas vazadas (HaveIBeenPwned).

**Status:** ⚠️ REQUER ATIVAÇÃO MANUAL

**Ação necessária:**
1. Acesse **Supabase Dashboard → Authentication → Providers → Email**
2. Ative **"Leaked Password Protection"**
3. Tire um print da tela após ativação

> 🔗 Link direto: https://supabase.com/dashboard/project/bguhckqkpnziykpbwbeu/auth/providers

---

### 2. ✅ Regras de Senha Mínimas

**Estado atual no código (validação client-side):**

| Parâmetro | Valor atual | Recomendado |
|-----------|-------------|-------------|
| `loginSchema.password.min()` | 6 caracteres | ✅ 8+ caracteres |
| `signupSchema.password.min()` | 6 caracteres | ✅ 8+ caracteres |
| `newPasswordSchema.password.min()` | 6 caracteres | ✅ 8+ caracteres |
| Complexidade (maiúscula, número, especial) | ❌ Não exigida | ⚠️ Recomendado |

**Status:** ⚠️ PRECISA ATUALIZAÇÃO (código + dashboard)

**Ações necessárias:**

**A) No Dashboard Supabase:**
1. Acesse **Authentication → Providers → Email**
2. Configure **"Minimum password length"** para **8**
3. (Opcional) Ative requisitos de complexidade se disponível

**B) No código (será atualizado por esta fase):**
- Atualizar `loginSchema`, `signupSchema` e `newPasswordSchema` para mínimo 8 caracteres
- Adicionar validação de complexidade (pelo menos 1 letra maiúscula + 1 número)

---

### 3. ✅ Email Verification

**Estado atual:**

| Configuração | Valor |
|-------------|-------|
| Confirm Email (Supabase) | ⚠️ Verificar no dashboard |
| `emailRedirectTo` no signup | ✅ Implementado (`window.location.origin`) |
| Tratamento de "Email not confirmed" | ✅ Implementado no AuthForm |
| Fluxo de recovery/reset | ✅ Implementado com token + session |

**Ação necessária:**
1. Acesse **Authentication → Providers → Email**
2. Verifique se **"Confirm email"** está **ativado** (recomendado para produção)
3. Se desativado para testes, reativar antes do launch

> ⚠️ NOTA: Com "Confirm email" ativado, novos usuários precisam verificar email antes de logar. O fluxo de signup já lida com isso mostrando a mensagem apropriada.

---

### 4. 🔍 Análise Adicional de Segurança Auth

| Item | Status | Detalhes |
|------|--------|---------|
| **Roles em tabela separada** | ✅ SEGURO | `user_roles` separada de `profiles` |
| **`has_role()` SECURITY DEFINER** | ✅ SEGURO | Evita recursão RLS |
| **`is_admin()` SECURITY DEFINER** | ✅ SEGURO | Função segura |
| **Password Recovery** | ✅ SEGURO | Fluxo completo com token via email |
| **Rate limiting em login** | ⚠️ PADRÃO | Depende do rate limit do Supabase Auth (built-in) |
| **Anti-enumeração de emails** | ✅ SEGURO | Signup retorna sucesso mesmo para emails existentes |
| **Session management** | ✅ SEGURO | `onAuthStateChange` + `getSession()` na ordem correta |
| **Zod validation** | ✅ IMPLEMENTADO | Login + Signup validados com zod |
| **Approval flow** | ✅ IMPLEMENTADO | Novos usuários ficam "pendente" até admin aprovar |
| **Recovery rate-limit handling** | ✅ SEGURO | Mostra tela de "email sent" mesmo em rate-limit (anti-enumeração) |

---

## AÇÕES PENDENTES (ADMINISTRADOR)

| # | Ação | Onde | Prioridade |
|---|------|------|-----------|
| 1 | Ativar Leaked Password Protection | Dashboard Auth Providers | 🔴 ALTA |
| 2 | Definir min password length = 8 | Dashboard Auth Providers | 🔴 ALTA |
| 3 | Confirmar "Confirm email" = ON | Dashboard Auth Providers | 🟠 MÉDIA |
| 4 | Atualizar schemas Zod para min 8 | Código (`validations.ts`) | 🟠 MÉDIA |

---

## EVIDÊNCIAS

> **Preencher após configuração no dashboard:**
> 
> - [ ] Print de Leaked Password Protection ativado
> - [ ] Print de min password = 8
> - [ ] Print de Confirm Email ativado
> - [ ] Commit com schemas Zod atualizados
