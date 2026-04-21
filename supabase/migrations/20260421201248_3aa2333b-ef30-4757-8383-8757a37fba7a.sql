-- Garantir 1 pipeline default por tenant + auto-elegibilidade

-- 1) Constraint: no máximo 1 default ativo por tenant
DROP INDEX IF EXISTS uniq_pipeline_default_per_tenant;
CREATE UNIQUE INDEX uniq_pipeline_default_per_tenant
  ON public.pipelines (tenant_id)
  WHERE is_default = true;

-- 2) Função: elege automaticamente um default quando o tenant não tem nenhum
CREATE OR REPLACE FUNCTION public.ensure_tenant_default_pipeline(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_default boolean;
  _candidate_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.pipelines
    WHERE tenant_id = _tenant_id AND is_default = true
  ) INTO _has_default;

  IF _has_default THEN
    RETURN;
  END IF;

  -- Prioridade 1: pipeline ativo chamado "Comercial" (case-insensitive)
  SELECT id INTO _candidate_id
  FROM public.pipelines
  WHERE tenant_id = _tenant_id
    AND is_active = true
    AND lower(name) = 'comercial'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Prioridade 2: primeiro pipeline ativo criado
  IF _candidate_id IS NULL THEN
    SELECT id INTO _candidate_id
    FROM public.pipelines
    WHERE tenant_id = _tenant_id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Prioridade 3: qualquer pipeline (mesmo inativo)
  IF _candidate_id IS NULL THEN
    SELECT id INTO _candidate_id
    FROM public.pipelines
    WHERE tenant_id = _tenant_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF _candidate_id IS NOT NULL THEN
    UPDATE public.pipelines
       SET is_default = true
     WHERE id = _candidate_id;
  END IF;
END;
$$;

-- 3) Trigger AFTER INSERT/UPDATE/DELETE: garante invariante
CREATE OR REPLACE FUNCTION public.trg_pipelines_maintain_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _tenant := OLD.tenant_id;
  ELSE
    _tenant := NEW.tenant_id;
  END IF;

  PERFORM public.ensure_tenant_default_pipeline(_tenant);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS pipelines_maintain_default ON public.pipelines;
CREATE TRIGGER pipelines_maintain_default
AFTER INSERT OR UPDATE OF is_default, is_active OR DELETE
ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.trg_pipelines_maintain_default();

-- 4) Backfill: aplicar para todos os tenants existentes
DO $$
DECLARE
  _t uuid;
BEGIN
  FOR _t IN SELECT DISTINCT tenant_id FROM public.pipelines LOOP
    PERFORM public.ensure_tenant_default_pipeline(_t);
  END LOOP;
END $$;