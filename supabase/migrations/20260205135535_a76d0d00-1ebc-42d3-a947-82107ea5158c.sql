-- ============================================================
-- SECURITY FIX #10: Corrigir exposição pública de dados de vendedores
-- ============================================================

-- Remover política de validação pública que expõe dados de vendedores
DROP POLICY IF EXISTS "Public can validate vendedor codes only" ON public.vendedores;

-- Criar função RPC segura para validação de código de vendedor (retorna apenas nome se válido)
CREATE OR REPLACE FUNCTION public.validate_vendedor_code(_codigo text)
RETURNS TABLE (
  codigo text,
  nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT codigo, nome
  FROM public.vendedores
  WHERE codigo ILIKE _codigo
    AND ativo = true
  LIMIT 1
$$;

-- ============================================================
-- SECURITY FIX #11: Restringir gamification_config para autenticados
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view gamification config" ON public.gamification_config;

CREATE POLICY "Usuários autenticados podem ver gamification config"
ON public.gamification_config
FOR SELECT
USING (auth.role() = 'authenticated');

-- ============================================================
-- SECURITY FIX #12: Restringir lead_status para autenticados
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view lead statuses" ON public.lead_status;

CREATE POLICY "Usuários autenticados podem ver lead_status"
ON public.lead_status
FOR SELECT
USING (auth.role() = 'authenticated');