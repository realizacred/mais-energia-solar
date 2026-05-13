-- Permitir 1 default por (tenant, grupo, tipo)
DROP INDEX IF EXISTS public.uq_proposta_templates_default_per_grupo;

CREATE UNIQUE INDEX uq_proposta_templates_default_per_grupo_tipo
  ON public.proposta_templates (tenant_id, grupo, tipo)
  WHERE (is_default = true);

-- Ajustar trigger para preferir HTML default por (tenant, grupo, tipo='html')
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

  -- 1) HTML default do grupo
  SELECT id INTO NEW.template_id_used
  FROM public.proposta_templates
  WHERE tenant_id = NEW.tenant_id
    AND COALESCE(ativo, true) = true
    AND tipo = 'html'
    AND is_default = true
    AND grupo = v_grupo
  LIMIT 1;

  -- 2) Qualquer HTML default ativo do tenant
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

  -- NUNCA atribuir DOCX ao slot WEB. Se não houver HTML, deixar NULL —
  -- /proposta/:token abre o PDF oficial automaticamente.
  RETURN NEW;
END $function$;

-- Seed: definir HTML default para grupo B do tenant principal
UPDATE public.proposta_templates
   SET is_default = true
 WHERE id = 'd237f952-186c-4996-a756-2d3cf3990a3b'
   AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND tipo = 'html';