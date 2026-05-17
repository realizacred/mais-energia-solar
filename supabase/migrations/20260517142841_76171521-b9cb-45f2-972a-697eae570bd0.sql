-- Ativar RLS se ainda não estiver (segurança)
ALTER TABLE public.analise_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_atividades ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para ANALISE_CREDITO
DROP POLICY IF EXISTS "consultor_ve_proprias_analises" ON public.analise_credito;
CREATE POLICY "consultor_ve_proprias_analises"
ON public.analise_credito
FOR SELECT
USING (
  criado_por = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);

DROP POLICY IF EXISTS "consultor_insere_proprias_analises" ON public.analise_credito;
CREATE POLICY "consultor_insere_proprias_analises"
ON public.analise_credito
FOR INSERT
WITH CHECK (
  criado_por = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);

-- 2. Políticas para LEAD_ATIVIDADES
DROP POLICY IF EXISTS "consultor_ve_proprias_atividades" ON public.lead_atividades;
CREATE POLICY "consultor_ve_proprias_atividades"
ON public.lead_atividades
FOR SELECT
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);

DROP POLICY IF EXISTS "consultor_modifica_proprias_atividades" ON public.lead_atividades;
CREATE POLICY "consultor_modifica_proprias_atividades"
ON public.lead_atividades
FOR ALL
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gerente', 'financeiro', 'super_admin')
  )
);