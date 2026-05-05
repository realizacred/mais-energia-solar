
CREATE OR REPLACE FUNCTION public.get_projeto_detalhe(_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_deal jsonb;
  v_history jsonb;
  v_user_names jsonb;
  v_stages jsonb;
  v_customer jsonb;
  v_owner_name text;
  v_pipelines jsonb;
  v_all_stages jsonb;
  v_gen_docs_count int;
  v_pipeline_id uuid;
  v_customer_id uuid;
  v_owner_id uuid;
BEGIN
  SELECT to_jsonb(d.*), d.pipeline_id, d.customer_id, d.owner_id
    INTO v_deal, v_pipeline_id, v_customer_id, v_owner_id
  FROM (
    SELECT id, title, value, kwp, status, created_at, updated_at, owner_id,
           pipeline_id, stage_id, customer_id, projeto_id, expected_close_date,
           motivo_perda_id, motivo_perda_obs, deal_num
    FROM public.deals
    WHERE id = _deal_id
  ) d;

  IF v_deal IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(h ORDER BY moved_at DESC), '[]'::jsonb)
    INTO v_history
  FROM (
    SELECT id, deal_id, from_stage_id, to_stage_id, moved_at, moved_by, metadata
    FROM public.deal_stage_history
    WHERE deal_id = _deal_id
  ) h;

  SELECT coalesce(jsonb_object_agg(user_id, nome), '{}'::jsonb)
    INTO v_user_names
  FROM public.profiles
  WHERE user_id IN (
    SELECT DISTINCT moved_by
    FROM public.deal_stage_history
    WHERE deal_id = _deal_id AND moved_by IS NOT NULL
  );

  SELECT coalesce(jsonb_agg(s ORDER BY position), '[]'::jsonb)
    INTO v_stages
  FROM (
    SELECT id, name, position, is_closed, is_won, probability
    FROM public.pipeline_stages
    WHERE pipeline_id = v_pipeline_id
  ) s;

  IF v_customer_id IS NOT NULL THEN
    SELECT to_jsonb(c.*) INTO v_customer
    FROM (
      SELECT nome, telefone, email, cpf_cnpj, empresa, rua, numero,
             bairro, cidade, estado, cep
      FROM public.clientes WHERE id = v_customer_id
    ) c;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    SELECT nome INTO v_owner_name FROM public.consultores WHERE id = v_owner_id;
  END IF;

  SELECT coalesce(jsonb_agg(p ORDER BY name), '[]'::jsonb)
    INTO v_pipelines
  FROM (
    SELECT id, name FROM public.pipelines WHERE is_active = true
  ) p;

  SELECT coalesce(jsonb_agg(s ORDER BY pipeline_id, position), '[]'::jsonb)
    INTO v_all_stages
  FROM (
    SELECT id, name, position, pipeline_id, is_closed, is_won, probability
    FROM public.pipeline_stages
  ) s;

  SELECT count(*) INTO v_gen_docs_count
  FROM public.generated_documents WHERE deal_id = _deal_id;

  RETURN jsonb_build_object(
    'deal', v_deal,
    'history', v_history,
    'user_names', v_user_names,
    'stages', v_stages,
    'customer', v_customer,
    'owner_name', v_owner_name,
    'pipelines', v_pipelines,
    'all_stages', v_all_stages,
    'generated_docs_count', v_gen_docs_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_projeto_detalhe(uuid) TO authenticated;
