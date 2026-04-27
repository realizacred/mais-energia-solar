-- 1) Recria o funil de execução "Comercial" espelho para o tenant principal
DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_funil_id uuid;
BEGIN
  SELECT id INTO v_funil_id
  FROM public.projeto_funis
  WHERE tenant_id = v_tenant AND lower(nome) = 'comercial'
  LIMIT 1;

  IF v_funil_id IS NULL THEN
    INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
    VALUES (v_tenant, 'Comercial', 0, true)
    RETURNING id INTO v_funil_id;
  END IF;

  INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, categoria)
  SELECT
    v_tenant,
    v_funil_id,
    ps.name,
    ps.position,
    (CASE
      WHEN ps.is_won THEN 'ganho'
      WHEN ps.is_closed AND NOT ps.is_won THEN 'perdido'
      ELSE 'aberto'
    END)::public.projeto_etapa_categoria
  FROM public.pipeline_stages ps
  WHERE ps.pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
    AND NOT EXISTS (
      SELECT 1 FROM public.projeto_etapas pe
      WHERE pe.funil_id = v_funil_id AND lower(pe.nome) = lower(ps.name)
    );
END $$;

-- 2) Triggers de espelho
CREATE OR REPLACE FUNCTION public.sync_delete_pipeline_to_projeto_funil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.projeto_etapas
  WHERE funil_id IN (
    SELECT id FROM public.projeto_funis
    WHERE tenant_id = OLD.tenant_id AND lower(nome) = lower(OLD.name)
  );
  DELETE FROM public.projeto_funis pf
  WHERE pf.tenant_id = OLD.tenant_id
    AND lower(pf.nome) = lower(OLD.name)
    AND NOT EXISTS (SELECT 1 FROM public.projetos p WHERE p.funil_id = pf.id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_delete_projeto_funil_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pipeline_stages
  WHERE pipeline_id IN (
    SELECT id FROM public.pipelines
    WHERE tenant_id = OLD.tenant_id AND lower(name) = lower(OLD.nome)
  );
  DELETE FROM public.pipelines pl
  WHERE pl.tenant_id = OLD.tenant_id
    AND lower(pl.name) = lower(OLD.nome)
    AND NOT EXISTS (SELECT 1 FROM public.deals d WHERE d.pipeline_id = pl.id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_delete_pipeline_mirror ON public.pipelines;
CREATE TRIGGER trg_sync_delete_pipeline_mirror
AFTER DELETE ON public.pipelines
FOR EACH ROW
EXECUTE FUNCTION public.sync_delete_pipeline_to_projeto_funil();

DROP TRIGGER IF EXISTS trg_sync_delete_projeto_funil_mirror ON public.projeto_funis;
CREATE TRIGGER trg_sync_delete_projeto_funil_mirror
AFTER DELETE ON public.projeto_funis
FOR EACH ROW
EXECUTE FUNCTION public.sync_delete_projeto_funil_to_pipeline();