-- Trigger BEFORE INSERT para garantir template_id_used em novas versões
CREATE OR REPLACE FUNCTION public.trg_proposta_versao_default_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo text;
BEGIN
  IF NEW.template_id_used IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_grupo := COALESCE(
    NULLIF(NEW.snapshot->>'grupo', ''),
    NULLIF(NEW.final_snapshot->>'grupo', ''),
    'B'
  );

  -- Tenta default do grupo correspondente
  SELECT id INTO NEW.template_id_used
  FROM public.proposta_templates
  WHERE tenant_id = NEW.tenant_id
    AND is_default = true
    AND grupo = v_grupo
  LIMIT 1;

  -- Fallback: qualquer default do tenant
  IF NEW.template_id_used IS NULL THEN
    SELECT id INTO NEW.template_id_used
    FROM public.proposta_templates
    WHERE tenant_id = NEW.tenant_id
      AND is_default = true
    ORDER BY grupo
    LIMIT 1;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposta_versao_default_template ON public.proposta_versoes;
CREATE TRIGGER trg_proposta_versao_default_template
  BEFORE INSERT ON public.proposta_versoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proposta_versao_default_template();

-- Backfill final das 2 versões pendentes
UPDATE public.proposta_versoes pv
SET template_id_used = sub.id
FROM (
  SELECT DISTINCT ON (tenant_id) id, tenant_id
  FROM public.proposta_templates
  WHERE is_default = true
  ORDER BY tenant_id, grupo
) sub
WHERE pv.template_id_used IS NULL
  AND sub.tenant_id = pv.tenant_id;