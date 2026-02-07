-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Restringir acesso a dados sensíveis
-- =====================================================

-- 1. TABELA PROFILES: Remover acesso público e restringir para autenticados
DROP POLICY IF EXISTS "Usuários autenticados podem ver perfis" ON public.profiles;

CREATE POLICY "Usuários autenticados podem ver perfis"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated'::text);

-- 2. TABELA CLIENTES: Restringir acesso a Admin, Gerente e Financeiro
DROP POLICY IF EXISTS "Usuários autenticados podem ver clientes" ON public.clientes;

CREATE POLICY "Admin/Gerente/Financeiro podem ver clientes"
ON public.clientes FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

-- Vendedor pode ver clientes de leads que ele originou
CREATE POLICY "Vendedor pode ver clientes de seus leads"
ON public.clientes FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role) 
  AND lead_id IN (
    SELECT id FROM public.leads 
    WHERE vendedor = get_vendedor_nome(auth.uid())
  )
);

-- 3. TABELA RECEBIMENTOS: Restringir a Admin, Gerente e Financeiro
DROP POLICY IF EXISTS "Usuários autenticados podem ver recebimentos" ON public.recebimentos;

CREATE POLICY "Admin/Gerente/Financeiro podem ver recebimentos"
ON public.recebimentos FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

-- 4. TABELA PAGAMENTOS: Restringir a Admin, Gerente e Financeiro
DROP POLICY IF EXISTS "Usuários autenticados podem ver pagamentos" ON public.pagamentos;

CREATE POLICY "Admin/Gerente/Financeiro podem ver pagamentos"
ON public.pagamentos FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

-- 5. TABELA PARCELAS: Restringir a Admin, Gerente e Financeiro
DROP POLICY IF EXISTS "Usuários autenticados podem ver parcelas" ON public.parcelas;

CREATE POLICY "Admin/Gerente/Financeiro podem ver parcelas"
ON public.parcelas FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

-- 6. TABELA VENDEDORES: Restringir acesso
-- Remover política muito aberta
DROP POLICY IF EXISTS "Authenticated users can view vendedores" ON public.vendedores;

-- Admin/Gerente podem ver todos
CREATE POLICY "Admin/Gerente podem ver todos vendedores"
ON public.vendedores FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Vendedor pode ver apenas seu próprio perfil (já existe, mantendo)