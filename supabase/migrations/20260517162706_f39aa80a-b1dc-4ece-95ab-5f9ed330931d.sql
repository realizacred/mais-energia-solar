-- Garantir que RLS esteja habilitado
ALTER TABLE public.analise_credito ENABLE ROW LEVEL SECURITY;

-- Criar política de visualização (SELECT)
DROP POLICY IF EXISTS "consultor_proprias_analises" ON public.analise_credito;
CREATE POLICY "consultor_proprias_analises"
ON public.analise_credito FOR SELECT
USING (
  criado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);

-- Criar política de inserção (INSERT)
DROP POLICY IF EXISTS "consultor_insere_proprias_analises" ON public.analise_credito;
CREATE POLICY "consultor_insere_proprias_analises"
ON public.analise_credito FOR INSERT
WITH CHECK (
  criado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);

-- Criar política de atualização (UPDATE)
DROP POLICY IF EXISTS "consultor_atualiza_proprias_analises" ON public.analise_credito;
CREATE POLICY "consultor_atualiza_proprias_analises"
ON public.analise_credito FOR UPDATE
USING (
  criado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);