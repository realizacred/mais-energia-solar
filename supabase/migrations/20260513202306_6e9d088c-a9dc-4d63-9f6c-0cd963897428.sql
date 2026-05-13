-- =====================================================================
-- FASE 1: Governança do is_default em proposta_templates
-- DOCX e HTML são defaults INDEPENDENTES (uniqueness por tenant_id+tipo)
-- =====================================================================

-- 1) Backfill defensivo: manter apenas o default mais recente por (tenant_id, tipo)
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    tipo,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, tipo
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.proposta_templates
  WHERE is_default = true
    AND ativo = true
)
UPDATE public.proposta_templates pt
SET is_default = false
FROM ranked r
WHERE pt.id = r.id
  AND r.rn > 1;

-- 2) Trigger de governança: ao marcar como default, desmarca os outros do mesmo (tenant_id, tipo)
CREATE OR REPLACE FUNCTION public.proposta_templates_enforce_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true AND COALESCE(NEW.ativo, true) = true THEN
    UPDATE public.proposta_templates
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND tipo = NEW.tipo
      AND id <> NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.proposta_templates_enforce_single_default() IS
'Garante UM unico template padrao por (tenant_id, tipo). DOCX e HTML sao independentes: cada tenant pode ter 1 default tipo=docx E 1 default tipo=html simultaneamente.';

DROP TRIGGER IF EXISTS trg_proposta_templates_single_default ON public.proposta_templates;
CREATE TRIGGER trg_proposta_templates_single_default
BEFORE INSERT OR UPDATE OF is_default, ativo, tipo, tenant_id
ON public.proposta_templates
FOR EACH ROW
EXECUTE FUNCTION public.proposta_templates_enforce_single_default();

-- 3) Indice parcial unico reforcando a regra (defesa em profundidade)
DROP INDEX IF EXISTS public.uniq_proposta_templates_default_per_tenant_tipo;
CREATE UNIQUE INDEX uniq_proposta_templates_default_per_tenant_tipo
ON public.proposta_templates (tenant_id, tipo)
WHERE is_default = true AND ativo = true;

COMMENT ON INDEX public.uniq_proposta_templates_default_per_tenant_tipo IS
'Reforca: no maximo 1 template ativo+default por (tenant_id, tipo). DOCX e HTML sao independentes.';

COMMENT ON COLUMN public.proposta_templates.is_default IS
'Marca o template padrao do tenant para o tipo correspondente. Defaults de tipo=docx e tipo=html sao INDEPENDENTES e coexistem. Trigger trg_proposta_templates_single_default + indice uniq_proposta_templates_default_per_tenant_tipo garantem unicidade por (tenant_id, tipo).';
