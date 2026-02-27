
-- FIX: current_tenant_id() usa profiles.id em vez de profiles.user_id
-- Corrigir para usar user_id (= auth.uid()) e adicionar SECURITY DEFINER + search_path
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;
