
-- Espelha 3 funis (Engenharia, Equipamento, Compesação) de pipelines/pipeline_stages
-- para projeto_funis/projeto_etapas, mantendo a mesma ordem de etapas.
-- Idempotente: NOT EXISTS evita duplicação se rodado novamente.

DO $$
DECLARE
  v_tenant uuid;
  v_funil_id uuid;
  v_max_ordem int;
  v_pipe RECORD;
  v_stage RECORD;
  v_categoria text;
BEGIN
  -- tenant alvo (mesmo da migração SolarMarket)
  v_tenant := '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid;

  -- próxima ordem
  SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem FROM projeto_funis WHERE tenant_id = v_tenant;

  FOR v_pipe IN
    SELECT id, name
    FROM pipelines
    WHERE tenant_id = v_tenant
      AND is_active = true
      AND name IN ('Engenharia','Equipamento','Compesação')
    ORDER BY name
  LOOP
    -- cria funil se ainda não existe (case-insensitive)
    SELECT id INTO v_funil_id
    FROM projeto_funis
    WHERE tenant_id = v_tenant
      AND lower(nome) = lower(v_pipe.name)
    LIMIT 1;

    IF v_funil_id IS NULL THEN
      v_max_ordem := v_max_ordem + 1;
      INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
      VALUES (v_tenant, v_pipe.name, v_max_ordem, true)
      RETURNING id INTO v_funil_id;
      RAISE NOTICE 'Funil criado: % (id=%)', v_pipe.name, v_funil_id;
    ELSE
      RAISE NOTICE 'Funil já existia: % (id=%)', v_pipe.name, v_funil_id;
    END IF;

    -- cria etapas faltantes
    FOR v_stage IN
      SELECT name, position, is_closed, is_won
      FROM pipeline_stages
      WHERE pipeline_id = v_pipe.id
      ORDER BY position
    LOOP
      v_categoria := CASE
        WHEN v_stage.is_won THEN 'ganho'
        WHEN v_stage.is_closed THEN 'perdido'
        ELSE 'aberto'
      END;

      IF NOT EXISTS (
        SELECT 1 FROM projeto_etapas
        WHERE funil_id = v_funil_id AND lower(nome) = lower(v_stage.name)
      ) THEN
        INSERT INTO projeto_etapas (tenant_id, funil_id, nome, ordem, categoria)
        VALUES (v_tenant, v_funil_id, v_stage.name, v_stage.position, v_categoria::projeto_etapa_categoria);
      END IF;
    END LOOP;
  END LOOP;
END $$;
