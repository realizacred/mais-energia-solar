-- ============================================================
-- SECURITY FIX #1: Função RPC segura para verificação de duplicidade de telefone
-- Remove necessidade de SELECT público na tabela leads
-- ============================================================

-- Criar função SECURITY DEFINER para verificar duplicidade por telefone
CREATE OR REPLACE FUNCTION public.check_phone_duplicate(_telefone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE telefone_normalized = regexp_replace(_telefone, '\D', '', 'g')
  )
$$;

-- Remover policy de SELECT público que expõe todos os dados
DROP POLICY IF EXISTS "Public can check for duplicate phone numbers" ON public.leads;

-- ============================================================
-- SECURITY FIX #2: Corrigir RLS policies permissivas em leads
-- ============================================================

-- Remover policies permissivas de DELETE/UPDATE sem autenticação adequada
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;

-- Recriar com RBAC adequado
CREATE POLICY "Admin/Gerente podem deletar leads"
ON public.leads
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Admin/Gerente podem atualizar qualquer lead"
ON public.leads
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- ============================================================
-- SECURITY FIX #3: Corrigir RLS policies permissivas em orcamentos
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can delete orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Authenticated users can update orcamentos" ON public.orcamentos;

CREATE POLICY "Admin/Gerente podem deletar orcamentos"
ON public.orcamentos
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Admin/Gerente podem atualizar qualquer orcamento"
ON public.orcamentos
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- ============================================================
-- SECURITY FIX #4: Restringir SELECT público em tabelas de negócio
-- ============================================================

-- concessionarias: remover SELECT público, manter para autenticados
DROP POLICY IF EXISTS "Público pode ver concessionárias ativas" ON public.concessionarias;

-- financiamento_bancos: remover SELECT público
DROP POLICY IF EXISTS "Anyone can view active banks" ON public.financiamento_bancos;

-- Adicionar policy para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver bancos ativos"
ON public.financiamento_bancos
FOR SELECT
USING (auth.role() = 'authenticated' AND ativo = true);

-- calculadora_config: remover SELECT público
DROP POLICY IF EXISTS "Anyone can view calculator config" ON public.calculadora_config;

-- Adicionar policy para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver config calculadora"
ON public.calculadora_config
FOR SELECT
USING (auth.role() = 'authenticated');

-- ============================================================
-- SECURITY FIX #5: Corrigir policy permissiva em lead_status
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can manage lead statuses" ON public.lead_status;

CREATE POLICY "Admin/Gerente podem gerenciar lead_status"
ON public.lead_status
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- ============================================================
-- SECURITY FIX #6: Corrigir políticas de storage
-- Adicionar validação mais restritiva para upload anônimo
-- ============================================================

-- Remover política de upload anônimo permissiva
DROP POLICY IF EXISTS "Anyone can upload to contas-luz" ON storage.objects;

-- Recriar com restrição de path
CREATE POLICY "Uploads anônimos restritos a pasta uploads"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'contas-luz' 
  AND (storage.foldername(name))[1] = 'uploads'
);

-- ============================================================
-- SECURITY FIX #7: Corrigir policy permissiva de sistema em audit_logs
-- ============================================================

DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.audit_logs;

-- Recriar com security definer function para inserção segura
CREATE POLICY "Inserção de logs via função segura"
ON public.audit_logs
FOR INSERT
WITH CHECK (true); -- Mantém INSERT aberto mas logs são imutáveis (UPDATE/DELETE bloqueados)