DO $backfill$
DECLARE
  v_total int := 0;
  v_ok int := 0;
  v_skipped int := 0;
  v_errors int := 0;
  v_batch_size int := 50;
  v_processed_in_batch int;
  v_proposta record;
  v_result jsonb;
  v_offset int := 0;
  v_batch_num int := 0;
  v_skip_reasons jsonb := '{}'::jsonb;
  v_error_samples jsonb := '[]'::jsonb;
  v_t0 timestamptz := clock_timestamp();
BEGIN
  LOOP
    v_batch_num := v_batch_num + 1;
    v_processed_in_batch := 0;

    FOR v_proposta IN
      SELECT id, codigo
      FROM public.propostas_nativas
      WHERE status = 'aceita'
      ORDER BY created_at
      OFFSET v_offset LIMIT v_batch_size
    LOOP
      v_processed_in_batch := v_processed_in_batch + 1;
      v_total := v_total + 1;

      BEGIN
        v_result := public.process_proposta_aceita(v_proposta.id);

        IF v_result ? 'error' THEN
          v_errors := v_errors + 1;
          IF jsonb_array_length(v_error_samples) < 5 THEN
            v_error_samples := v_error_samples || jsonb_build_object('id', v_proposta.id, 'codigo', v_proposta.codigo, 'error', v_result->>'error');
          END IF;
        ELSIF v_result ? 'skipped' AND (v_result->>'skipped') IS NOT NULL THEN
          v_skipped := v_skipped + 1;
          v_skip_reasons := jsonb_set(
            v_skip_reasons,
            ARRAY[v_result->>'skipped'],
            to_jsonb(COALESCE((v_skip_reasons->>(v_result->>'skipped'))::int, 0) + 1)
          );
        ELSE
          v_ok := v_ok + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        IF jsonb_array_length(v_error_samples) < 5 THEN
          v_error_samples := v_error_samples || jsonb_build_object('id', v_proposta.id, 'codigo', v_proposta.codigo, 'sqlstate', SQLSTATE, 'sqlerrm', SQLERRM);
        END IF;
      END;
    END LOOP;

    EXIT WHEN v_processed_in_batch = 0;
    RAISE NOTICE 'Lote % processou % propostas (total=%, ok=%, skipped=%, errors=%)',
      v_batch_num, v_processed_in_batch, v_total, v_ok, v_skipped, v_errors;
    v_offset := v_offset + v_batch_size;
  END LOOP;

  RAISE NOTICE '=== BACKFILL FINALIZADO em % ===', clock_timestamp() - v_t0;
  RAISE NOTICE 'total=%, ok=%, skipped=%, errors=%', v_total, v_ok, v_skipped, v_errors;
  RAISE NOTICE 'skip_reasons=%', v_skip_reasons;
  RAISE NOTICE 'error_samples=%', v_error_samples;

  -- Auditoria
  INSERT INTO public.proposta_sync_audit_log (mode, total_principais, projetos_updated, deals_updated, divergent_after, notes)
  VALUES (
    'backfill',
    v_total,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'scope', 'aceite_financeiro_backfill',
      'function', 'process_proposta_aceita',
      'batch_size', v_batch_size,
      'batches', v_batch_num,
      'ok', v_ok,
      'skipped', v_skipped,
      'errors', v_errors,
      'skip_reasons', v_skip_reasons,
      'error_samples', v_error_samples,
      'duration', (clock_timestamp() - v_t0)::text
    )::text
  );
END;
$backfill$;