
DO $$
DECLARE
  v_count int := 0;
BEGIN
  PERFORM public.sync_proposta_to_projeto_deal(id)
  FROM public.propostas_nativas
  WHERE is_principal = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfill executado em % propostas principais', v_count;
END $$;
