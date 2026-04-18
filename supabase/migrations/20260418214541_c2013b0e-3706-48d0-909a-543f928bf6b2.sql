-- Restaurar funil "Comercial" + etapa "Verificar Dados" e resetar classificações podres
DO $$
DECLARE
  v_tenant_id uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_funil_id uuid;
  v_etapa_id uuid;
  v_max_ordem int;
BEGIN
  -- 1) Funil Comercial
  SELECT id INTO v_funil_id
  FROM public.projeto_funis
  WHERE tenant_id = v_tenant_id
    AND lower(unaccent(nome)) = 'comercial'
  LIMIT 1;

  IF v_funil_id IS NULL THEN
    INSERT INTO public.projeto_funis (tenant_id, nome, ordem, ativo)
    VALUES (v_tenant_id, 'Comercial', 1, true)
    RETURNING id INTO v_funil_id;
  END IF;

  -- 2) Etapa "Verificar Dados"
  SELECT id INTO v_etapa_id
  FROM public.projeto_etapas
  WHERE funil_id = v_funil_id
    AND lower(unaccent(nome)) = 'verificar dados'
  LIMIT 1;

  IF v_etapa_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem
    FROM public.projeto_etapas WHERE funil_id = v_funil_id;
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
    VALUES (v_tenant_id, v_funil_id, 'Verificar Dados', v_max_ordem + 1, '#f59e0b', 'aberto');
  END IF;

  -- 3) Etapas operacionais mínimas para o funil Comercial
  PERFORM 1 FROM public.projeto_etapas WHERE funil_id = v_funil_id AND lower(unaccent(nome)) = 'novo';
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(ordem),0) INTO v_max_ordem FROM public.projeto_etapas WHERE funil_id = v_funil_id;
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
    VALUES (v_tenant_id, v_funil_id, 'Novo', v_max_ordem+1, '#3b82f6', 'aberto');
  END IF;

  PERFORM 1 FROM public.projeto_etapas WHERE funil_id = v_funil_id AND lower(unaccent(nome)) = 'em andamento';
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(ordem),0) INTO v_max_ordem FROM public.projeto_etapas WHERE funil_id = v_funil_id;
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
    VALUES (v_tenant_id, v_funil_id, 'Em Andamento', v_max_ordem+1, '#8b5cf6', 'aberto');
  END IF;

  PERFORM 1 FROM public.projeto_etapas WHERE funil_id = v_funil_id AND lower(unaccent(nome)) = 'ganho';
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(ordem),0) INTO v_max_ordem FROM public.projeto_etapas WHERE funil_id = v_funil_id;
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
    VALUES (v_tenant_id, v_funil_id, 'Ganho', v_max_ordem+1, '#10b981', 'ganho');
  END IF;

  PERFORM 1 FROM public.projeto_etapas WHERE funil_id = v_funil_id AND lower(unaccent(nome)) = 'perdido';
  IF NOT FOUND THEN
    SELECT COALESCE(MAX(ordem),0) INTO v_max_ordem FROM public.projeto_etapas WHERE funil_id = v_funil_id;
    INSERT INTO public.projeto_etapas (tenant_id, funil_id, nome, ordem, cor, categoria)
    VALUES (v_tenant_id, v_funil_id, 'Perdido', v_max_ordem+1, '#ef4444', 'perdido');
  END IF;
END $$;

-- 4) Resetar classificações podres (funil_destino_id NULL) para nova rodada
UPDATE public.sm_project_classification
SET 
  resolution_status = 'pending',
  resolved_funil_id = NULL,
  resolved_etapa_id = NULL,
  resolution_error = NULL,
  resolved_at = NULL
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND funil_destino_id IS NULL;

-- 5) Apagar classificações órfãs para forçar classify-sm-projects a recalcular do zero
DELETE FROM public.sm_project_classification
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND funil_destino_id IS NULL;