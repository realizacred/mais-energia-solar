DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  r_funil  record;
  r_etapa  record;
  v_funil_id uuid;
  v_next_ordem int;
  v_total_stages int;
BEGIN
  FOR r_funil IN
    SELECT sf.payload->>'name' AS nome,
           sf.payload->'stages' AS stages
      FROM sm_funis_raw sf
      JOIN sm_funil_pipeline_map m
        ON m.tenant_id = sf.tenant_id
       AND m.sm_funil_name = (sf.payload->>'name')
       AND m.role = 'pipeline'
     WHERE sf.tenant_id = v_tenant
  LOOP
    SELECT id INTO v_funil_id
      FROM projeto_funis
     WHERE tenant_id = v_tenant
       AND lower(nome) = lower(r_funil.nome)
     LIMIT 1;

    IF v_funil_id IS NULL THEN
      SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_next_ordem
        FROM projeto_funis WHERE tenant_id = v_tenant;

      INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
      VALUES (v_tenant, r_funil.nome, v_next_ordem, true)
      RETURNING id INTO v_funil_id;
    END IF;

    v_total_stages := jsonb_array_length(COALESCE(r_funil.stages, '[]'::jsonb));

    FOR r_etapa IN
      SELECT (elem->>'name') AS etapa_nome, ord
        FROM jsonb_array_elements(COALESCE(r_funil.stages, '[]'::jsonb))
             WITH ORDINALITY AS t(elem, ord)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM projeto_etapas
         WHERE tenant_id = v_tenant
           AND funil_id = v_funil_id
           AND lower(nome) = lower(COALESCE(r_etapa.etapa_nome, 'Etapa '||r_etapa.ord))
      ) THEN
        INSERT INTO projeto_etapas (tenant_id, funil_id, nome, ordem, categoria)
        VALUES (
          v_tenant,
          v_funil_id,
          COALESCE(NULLIF(trim(r_etapa.etapa_nome), ''), 'Etapa '||r_etapa.ord),
          (r_etapa.ord - 1)::int,
          (CASE WHEN r_etapa.ord = v_total_stages THEN 'ganho' ELSE 'aberto' END)::projeto_etapa_categoria
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;