DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.backfill_projetos_funil_etapa('17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid);
  RAISE NOTICE 'backfill_projetos_funil_etapa => %', v_result;
END
$$;