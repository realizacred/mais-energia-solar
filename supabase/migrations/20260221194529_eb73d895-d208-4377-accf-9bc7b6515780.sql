
-- Enhanced sync: handles ALL BT subgroups (B1, B2, B3) and ALL MT subgroups (A1-A4)
-- Reports per-subgrupo detail for the proposal generator
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
  v_bt_all jsonb;
  v_mt_all jsonb;
  sub record;
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
      c.tarifa_fio_b AS old_fio_b
    FROM concessionarias c
    WHERE c.tenant_id = v_tenant_id
      AND c.ativo = true
  LOOP
    v_total := v_total + 1;

    -- Collect ALL active BT subgroups (B1, B2, B3, etc.)
    v_bt_all := '[]'::jsonb;
    FOR sub IN
      SELECT cts.subgrupo, cts.tarifa_energia, cts.tarifa_fio_b, cts.tarifacao_bt, cts.origem
      FROM concessionaria_tarifas_subgrupo cts
      WHERE cts.concessionaria_id = rec.conc_id
        AND cts.tenant_id = v_tenant_id
        AND cts.is_active = true
        AND cts.subgrupo LIKE 'B%'
      ORDER BY cts.subgrupo, cts.updated_at DESC
    LOOP
      v_bt_all := v_bt_all || jsonb_build_object(
        'subgrupo', sub.subgrupo,
        'tarifa_energia', sub.tarifa_energia,
        'tarifa_fio_b', sub.tarifa_fio_b,
        'tarifacao_bt', sub.tarifacao_bt,
        'origem', sub.origem
      );
    END LOOP;

    -- Collect ALL active MT subgroups (A1, A2, A3, A3a, A4, etc.)
    v_mt_all := '[]'::jsonb;
    FOR sub IN
      SELECT cts.subgrupo, cts.modalidade_tarifaria, cts.te_ponta, cts.tusd_ponta,
             cts.te_fora_ponta, cts.tusd_fora_ponta, cts.fio_b_ponta, cts.fio_b_fora_ponta,
             cts.demanda_consumo_rs, cts.demanda_geracao_rs, cts.tarifacao_ponta,
             cts.tarifacao_fora_ponta, cts.origem
      FROM concessionaria_tarifas_subgrupo cts
      WHERE cts.concessionaria_id = rec.conc_id
        AND cts.tenant_id = v_tenant_id
        AND cts.is_active = true
        AND cts.subgrupo LIKE 'A%'
      ORDER BY cts.subgrupo, cts.modalidade_tarifaria, cts.updated_at DESC
    LOOP
      v_mt_all := v_mt_all || jsonb_build_object(
        'subgrupo', sub.subgrupo,
        'modalidade', sub.modalidade_tarifaria,
        'te_ponta', sub.te_ponta,
        'tusd_ponta', sub.tusd_ponta,
        'te_fora_ponta', sub.te_fora_ponta,
        'tusd_fora_ponta', sub.tusd_fora_ponta,
        'fio_b_ponta', sub.fio_b_ponta,
        'fio_b_fora_ponta', sub.fio_b_fora_ponta,
        'demanda', sub.demanda_consumo_rs,
        'demanda_geracao', sub.demanda_geracao_rs,
        'tarifacao_ponta', sub.tarifacao_ponta,
        'tarifacao_fora_ponta', sub.tarifacao_fora_ponta,
        'origem', sub.origem
      );
    END LOOP;

    -- Use the first BT record (typically B1) for the concessionarias table update
    IF jsonb_array_length(v_bt_all) > 0 THEN
      DECLARE
        v_best_bt jsonb := v_bt_all->0;
        v_new_te numeric := (v_best_bt->>'tarifa_energia')::numeric;
        v_new_fio_b numeric := (v_best_bt->>'tarifa_fio_b')::numeric;
      BEGIN
        IF (rec.old_te IS DISTINCT FROM COALESCE(v_new_te, rec.old_te))
           OR (rec.old_fio_b IS DISTINCT FROM COALESCE(v_new_fio_b, rec.old_fio_b)) THEN

          UPDATE concessionarias
          SET tarifa_energia = COALESCE(v_new_te, tarifa_energia),
              tarifa_fio_b = COALESCE(v_new_fio_b, tarifa_fio_b),
              updated_at = now()
          WHERE id = rec.conc_id AND tenant_id = v_tenant_id;

          v_details := v_details || jsonb_build_object(
            'nome', rec.conc_nome,
            'sigla', rec.conc_sigla,
            'estado', rec.conc_estado,
            'status', 'atualizada',
            'bt_all', v_bt_all,
            'mt_all', CASE WHEN jsonb_array_length(v_mt_all) > 0 THEN v_mt_all ELSE NULL END,
            'te_change', jsonb_build_object('de', rec.old_te, 'para', v_new_te),
            'fio_b_change', jsonb_build_object('de', rec.old_fio_b, 'para', v_new_fio_b)
          );
          v_updated := v_updated + 1;
        ELSE
          v_details := v_details || jsonb_build_object(
            'nome', rec.conc_nome,
            'sigla', rec.conc_sigla,
            'estado', rec.conc_estado,
            'status', 'sem_alteracao',
            'bt_all', v_bt_all,
            'mt_all', CASE WHEN jsonb_array_length(v_mt_all) > 0 THEN v_mt_all ELSE NULL END
          );
        END IF;
      END;
    ELSE
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'nome', rec.conc_nome,
        'sigla', rec.conc_sigla,
        'estado', rec.conc_estado,
        'status', 'sem_dados',
        'mt_all', CASE WHEN jsonb_array_length(v_mt_all) > 0 THEN v_mt_all ELSE NULL END
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
