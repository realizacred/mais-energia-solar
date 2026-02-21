CREATE OR REPLACE FUNCTION public.sync_concessionarias_from_subgrupos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_updated int := 0;
  v_skipped int := 0;
  v_total int := 0;
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
           bt.tarifa_energia AS bt_te,
           bt.tarifa_fio_b AS bt_fio_b
    FROM concessionarias c
    LEFT JOIN LATERAL (
      SELECT cts.tarifa_energia, cts.tarifa_fio_b
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

    IF rec.bt_te IS NOT NULL OR rec.bt_fio_b IS NOT NULL THEN
      UPDATE concessionarias
      SET tarifa_energia = COALESCE(rec.bt_te, tarifa_energia),
          tarifa_fio_b = COALESCE(rec.bt_fio_b, tarifa_fio_b),
          updated_at = now()
      WHERE id = rec.conc_id
        AND tenant_id = v_tenant_id;
      v_updated := v_updated + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'updated', v_updated,
    'skipped', v_skipped
  );
END;
$$;