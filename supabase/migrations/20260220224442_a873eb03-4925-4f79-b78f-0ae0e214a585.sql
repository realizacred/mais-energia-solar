
-- Permitir UPDATE em módulos globais (tenant_id IS NULL) além dos módulos do próprio tenant
-- Contexto: módulos com tenant_id = NULL são do catálogo global e devem ser editáveis
-- por qualquer usuário autenticado (para adicionar datasheet, extrair dados com IA, etc.)

DROP POLICY IF EXISTS "Atualizar módulos do próprio tenant" ON public.modulos_solares;

CREATE POLICY "Atualizar módulos do próprio tenant ou globais"
ON public.modulos_solares
FOR UPDATE
USING (
  (tenant_id = get_user_tenant_id()) OR (tenant_id IS NULL)
);
