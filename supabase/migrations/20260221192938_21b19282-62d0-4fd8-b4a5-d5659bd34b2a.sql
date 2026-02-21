
-- Enhanced sync function that returns per-concessionária change details
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
  -- Resolve tenant from current user
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = auth.uid();

  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM consultores
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Tenant não encontrado para o usuário atual');
  END IF;

  FOR rec IN
    SELECT c.id AS conc_id,
           c.nome AS conc_nome,
           c.sigla AS conc_sigla,
           c.tarifa_energia AS old_te,
           c.tarifa_fio_b AS old_fio_b,
           bt.tarifa_energia AS new_te,
           bt.tarifa_fio_b AS new_fio_b,
           bt.subgrupo AS fonte_subgrupo,
           bt.origem AS fonte_origem
    FROM concessionarias c
    LEFT JOIN LATERAL (
      SELECT cts.tarifa_energia, cts.tarifa_fio_b, cts.subgrupo, cts.origem
      FROM concessionaria_tarifas_subgrupo cts
      WHERE cts.concessionaria_id = c.id
        AND cts.tenant_id = v_tenant_id
        AND cts.is_active = true
        AND cts.subgrupo LIKE 'B1%'
      ORDER BY cts.updated_at DESC
      LIMIT 1
    ) bt ON true
    WHERE c.tenant_id = v_tenant_id
      AND c.ativo = true
  LOOP
    v_total := v_total + 1;

    IF rec.new_te IS NOT NULL OR rec.new_fio_b IS NOT NULL THEN
      -- Check if values actually changed
      IF (rec.old_te IS DISTINCT FROM COALESCE(rec.new_te, rec.old_te))
         OR (rec.old_fio_b IS DISTINCT FROM COALESCE(rec.new_fio_b, rec.old_fio_b)) THEN

        UPDATE concessionarias
        SET tarifa_energia = COALESCE(rec.new_te, tarifa_energia),
            tarifa_fio_b = COALESCE(rec.new_fio_b, tarifa_fio_b),
            updated_at = now()
        WHERE id = rec.conc_id
          AND tenant_id = v_tenant_id;

        v_details := v_details || jsonb_build_object(
          'nome', rec.conc_nome,
          'sigla', rec.conc_sigla,
          'status', 'atualizada',
          'fonte', COALESCE(rec.fonte_subgrupo, 'B1'),
          'origem', COALESCE(rec.fonte_origem, 'manual'),
          'changes', jsonb_build_object(
            'tarifa_energia', jsonb_build_object('de', rec.old_te, 'para', rec.new_te),
            'tarifa_fio_b', jsonb_build_object('de', rec.old_fio_b, 'para', rec.new_fio_b)
          )
        );
        v_updated := v_updated + 1;
      ELSE
        -- Values are the same, no update needed
        v_details := v_details || jsonb_build_object(
          'nome', rec.conc_nome,
          'sigla', rec.conc_sigla,
          'status', 'sem_alteracao',
          'fonte', COALESCE(rec.fonte_subgrupo, 'B1')
        );
      END IF;
    ELSE
      v_skipped := v_skipped + 1;
      v_details := v_details || jsonb_build_object(
        'nome', rec.conc_nome,
        'sigla', rec.conc_sigla,
        'status', 'sem_dados'
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
