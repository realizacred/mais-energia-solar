CREATE OR REPLACE FUNCTION public.trg_proposta_versao_default_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- 1) Default HTML ativo do grupo
  SELECT id INTO NEW.template_id_used
  FROM public.proposta_templates
  WHERE tenant_id = NEW.tenant_id
    AND COALESCE(ativo, true) = true
    AND tipo = 'html'
    AND is_default = true
    AND grupo = v_grupo
  LIMIT 1;

  -- 2) Qualquer default HTML ativo do tenant
  IF NEW.template_id_used IS NULL THEN
    SELECT id INTO NEW.template_id_used
    FROM public.proposta_templates
    WHERE tenant_id = NEW.tenant_id
      AND COALESCE(ativo, true) = true
      AND tipo = 'html'
      AND is_default = true
    ORDER BY grupo
    LIMIT 1;
  END IF;

  -- 3) Qualquer HTML ativo do tenant para o grupo
  IF NEW.template_id_used IS NULL THEN
    SELECT id INTO NEW.template_id_used
    FROM public.proposta_templates
    WHERE tenant_id = NEW.tenant_id
      AND COALESCE(ativo, true) = true
      AND tipo = 'html'
      AND grupo = v_grupo
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- 4) Qualquer HTML ativo do tenant
  IF NEW.template_id_used IS NULL THEN
    SELECT id INTO NEW.template_id_used
    FROM public.proposta_templates
    WHERE tenant_id = NEW.tenant_id
      AND COALESCE(ativo, true) = true
      AND tipo = 'html'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- IMPORTANTE: NUNCA atribuir template DOCX ao slot WEB.
  -- Se não houver HTML disponível, deixar template_id_used NULL —
  -- a rota /proposta/:token irá abrir o PDF oficial.
  RETURN NEW;
END $function$;