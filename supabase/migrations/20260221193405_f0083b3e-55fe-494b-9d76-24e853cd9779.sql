
-- Enhanced sync: includes both BT (B1) and MT (A4/A3) data in the report
DROP FUNCTION IF EXISTS public.sync_concessionarias_from_subgrupos();

CREATE OR REPLACE FUNCTION public.sync_concessionarias_from_subgrupos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_updated int := 0;
  v_skipped int := 0;
  v_total int := 0;
  v_details jsonb := '[]'::jsonb;
  rec record;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = auth.uid();
  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id FROM consultores WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Tenant não encontrado para o usuário atual');
  END IF;

  FOR rec IN
    SELECT 
      c.id AS conc_id,
      c.nome AS conc_nome,
      c.sigla AS conc_sigla,
      c.estado AS conc_estado,
      c.tarifa_energia AS old_te,
      c.tarifa_fio_b AS old_fio_b,
      -- BT data
      bt.tarifa_energia AS bt_te,
      bt.tarifa_fio_b AS bt_fio_b,
      bt.subgrupo AS bt_subgrupo,
      bt.origem AS bt_origem,
      bt.tarifacao_bt AS bt_tarifacao,
      -- MT data (best candidate: A4 Verde > A4 Azul > A3 Verde > A3 Azul)
      mt.subgrupo AS mt_subgrupo,
      mt.modalidade_tarifaria AS mt_modalidade,
      mt.te_ponta AS mt_te_ponta,
      mt.tusd_ponta AS mt_tusd_ponta,
      mt.te_fora_ponta AS mt_te_fora_ponta,
      mt.tusd_fora_ponta AS mt_tusd_fora_ponta,
      mt.fio_b_ponta AS mt_fio_b_ponta,
      mt.fio_b_fora_ponta AS mt_fio_b_fora_ponta,
      mt.demanda_consumo_rs AS mt_demanda,
      mt.demanda_geracao_rs AS mt_demanda_ger,
      mt.tarifacao_ponta AS mt_tarifacao_ponta,
      mt.tarifacao_fora_ponta AS mt_tarifacao_fp,
      mt.origem AS mt_origem
    FROM concessionarias c
    LEFT JOIN LATERAL (
      SELECT cts.*
      FROM concessionaria_tarifas_subgrupo cts
      WHERE cts.concessionaria_id = c.id
        AND cts.tenant_id = v_tenant_id
        AND cts.is_active = true
        AND cts.subgrupo LIKE 'B1%'
      ORDER BY cts.updated_at DESC
      LIMIT 1
    ) bt ON true
    LEFT JOIN LATERAL (
      SELECT cts.*
      FROM concessionaria_tarifas_subgrupo cts
      WHERE cts.concessionaria_id = c.id
        AND cts.tenant_id = v_tenant_id
        AND cts.is_active = true
        AND (cts.subgrupo LIKE 'A4%' OR cts.subgrupo LIKE 'A3%')
      ORDER BY 
        CASE WHEN cts.subgrupo LIKE 'A4%' THEN 0 ELSE 1 END,
        CASE WHEN cts.modalidade_tarifaria = 'Verde' THEN 0 ELSE 1 END,
        cts.updated_at DESC
      LIMIT 1
    ) mt ON true
    WHERE c.tenant_id = v_tenant_id
      AND c.ativo = true
  LOOP
    v_total := v_total + 1;

    IF rec.bt_te IS NOT NULL OR rec.bt_fio_b IS NOT NULL THEN
      IF (rec.old_te IS DISTINCT FROM COALESCE(rec.bt_te, rec.old_te))
         OR (rec.old_fio_b IS DISTINCT FROM COALESCE(rec.bt_fio_b, rec.old_fio_b)) THEN

        UPDATE concessionarias
        SET tarifa_energia = COALESCE(rec.bt_te, tarifa_energia),
            tarifa_fio_b = COALESCE(rec.bt_fio_b, tarifa_fio_b),
            updated_at = now()
        WHERE id = rec.conc_id AND tenant_id = v_tenant_id;

        v_details := v_details || jsonb_build_object(
          'nome', rec.conc_nome,
          'sigla', rec.conc_sigla,
          'estado', rec.conc_estado,
          'status', 'atualizada',
          'bt', jsonb_build_object(
            'subgrupo', rec.bt_subgrupo,
            'origem', rec.bt_origem,
            'te', jsonb_build_object('de', rec.old_te, 'para', rec.bt_te),
            'fio_b', jsonb_build_object('de', rec.old_fio_b, 'para', rec.bt_fio_b),
            'tarifacao_bt', rec.bt_tarifacao
          ),
          'mt', CASE WHEN rec.mt_subgrupo IS NOT NULL THEN jsonb_build_object(
            'subgrupo', rec.mt_subgrupo,
            'modalidade', rec.mt_modalidade,
            'origem', rec.mt_origem,
            'te_ponta', rec.mt_te_ponta,
            'tusd_ponta', rec.mt_tusd_ponta,
            'te_fora_ponta', rec.mt_te_fora_ponta,
            'tusd_fora_ponta', rec.mt_tusd_fora_ponta,
            'fio_b_ponta', rec.mt_fio_b_ponta,
            'fio_b_fora_ponta', rec.mt_fio_b_fora_ponta,
            'demanda', rec.mt_demanda,
            'demanda_geracao', rec.mt_demanda_ger,
            'tarifacao_ponta', rec.mt_tarifacao_ponta,
            'tarifacao_fora_ponta', rec.mt_tarifacao_fp
          ) ELSE NULL END
        );
        v_updated := v_updated + 1;
      ELSE
        v_details := v_details || jsonb_build_object(
          'nome', rec.conc_nome,
          'sigla', rec.conc_sigla,
          'estado', rec.conc_estado,
          'status', 'sem_alteracao',
          'bt', jsonb_build_object('subgrupo', rec.bt_subgrupo),
          'mt', CASE WHEN rec.mt_subgrupo IS NOT NULL THEN jsonb_build_object(
            'subgrupo', rec.mt_subgrupo, 'modalidade', rec.mt_modalidade
          ) ELSE NULL END
        );
      END IF;
    ELSE
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'nome', rec.conc_nome,
        'sigla', rec.conc_sigla,
        'estado', rec.conc_estado,
        'status', 'sem_dados',
        'mt', CASE WHEN rec.mt_subgrupo IS NOT NULL THEN jsonb_build_object(
          'subgrupo', rec.mt_subgrupo, 'modalidade', rec.mt_modalidade
        ) ELSE NULL END
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'updated', v_updated,
    'skipped', v_skipped,
    'unchanged', v_total - v_updated - v_skipped,
    'details', v_details
  );
END;
$$;
