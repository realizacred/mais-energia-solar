
-- =========================================================
-- 1. Audit log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cascade_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cascade_deletion_log_tenant ON public.cascade_deletion_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cascade_deletion_log_entity ON public.cascade_deletion_log(entity_type, entity_id);

ALTER TABLE public.cascade_deletion_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant read cascade log" ON public.cascade_deletion_log;
CREATE POLICY "tenant read cascade log"
  ON public.cascade_deletion_log FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Inserts apenas via SECURITY DEFINER das RPCs

-- =========================================================
-- 2. delete_cliente_cascade — com guard de tenant + audit
-- =========================================================
CREATE OR REPLACE FUNCTION public.delete_cliente_cascade(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_caller_tenant uuid;
  v_proj_ids uuid[];
  v_prop_ids uuid[];
  v_versao_ids uuid[];
  v_deal_ids uuid[];
  v_counts jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.clientes WHERE id = p_cliente_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('error','cliente_not_found');
  END IF;

  -- 🔒 Cross-tenant guard
  v_caller_tenant := public.current_tenant_id();
  IF v_caller_tenant IS NULL OR v_caller_tenant <> v_tenant THEN
    RAISE EXCEPTION 'cross_tenant_forbidden' USING ERRCODE = '42501';
  END IF;

  -- Coletar IDs vinculados
  SELECT array_agg(id) INTO v_proj_ids FROM public.projetos WHERE cliente_id = p_cliente_id;
  SELECT array_agg(id) INTO v_prop_ids FROM public.propostas_nativas WHERE cliente_id = p_cliente_id;
  SELECT array_agg(id) INTO v_deal_ids FROM public.deals WHERE customer_id = p_cliente_id;

  IF v_prop_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_versao_ids
    FROM public.proposta_versoes WHERE proposta_id = ANY(v_prop_ids);
  END IF;

  -- Limpar circular ref em proposta_versoes
  IF v_versao_ids IS NOT NULL THEN
    UPDATE public.proposta_versoes
       SET substituida_por = NULL
     WHERE substituida_por = ANY(v_versao_ids) OR id = ANY(v_versao_ids);
  END IF;

  -- Quebrar FKs RESTRICT
  DELETE FROM public.vendas_transacional
   WHERE cliente_id = p_cliente_id
      OR (v_versao_ids IS NOT NULL AND versao_id = ANY(v_versao_ids))
      OR (v_prop_ids IS NOT NULL AND proposta_id = ANY(v_prop_ids));

  DELETE FROM public.recibos_emitidos WHERE cliente_id = p_cliente_id;

  IF v_proj_ids IS NOT NULL THEN
    UPDATE public.projetos
       SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
     WHERE id = ANY(v_proj_ids);
  END IF;

  IF v_deal_ids IS NOT NULL THEN
    DELETE FROM public.deals WHERE id = ANY(v_deal_ids);
  END IF;

  IF v_proj_ids IS NOT NULL THEN
    DELETE FROM public.projetos WHERE id = ANY(v_proj_ids);
  END IF;

  IF v_prop_ids IS NOT NULL THEN
    DELETE FROM public.propostas_nativas WHERE id = ANY(v_prop_ids);
  END IF;

  DELETE FROM public.external_entity_links
   WHERE entity_id = p_cliente_id
      OR (v_proj_ids IS NOT NULL AND entity_id = ANY(v_proj_ids))
      OR (v_prop_ids IS NOT NULL AND entity_id = ANY(v_prop_ids))
      OR (v_deal_ids IS NOT NULL AND entity_id = ANY(v_deal_ids));

  DELETE FROM public.clientes WHERE id = p_cliente_id;

  v_counts := jsonb_build_object(
    'cliente_id', p_cliente_id,
    'projetos', COALESCE(array_length(v_proj_ids,1),0),
    'propostas', COALESCE(array_length(v_prop_ids,1),0),
    'deals', COALESCE(array_length(v_deal_ids,1),0),
    'versoes', COALESCE(array_length(v_versao_ids,1),0)
  );

  -- 📜 Audit
  INSERT INTO public.cascade_deletion_log (actor_user_id, tenant_id, entity_type, entity_id, counts)
  VALUES (auth.uid(), v_tenant, 'cliente', p_cliente_id, v_counts);

  RETURN v_counts;
END;
$$;

-- =========================================================
-- 3. delete_lead_cascade — com guard + vendas + audit
-- =========================================================
CREATE OR REPLACE FUNCTION public.delete_lead_cascade(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_caller_tenant uuid;
  v_cliente_ids uuid[];
  v_proj_ids uuid[];
  v_prop_ids uuid[];
  v_deal_ids uuid[];
  v_versao_ids uuid[];
  v_cli uuid;
  v_clientes_apagados int := 0;
  v_vendas_apagadas int := 0;
  v_counts jsonb;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.leads WHERE id = p_lead_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('error','lead_not_found');
  END IF;

  -- 🔒 Cross-tenant guard
  v_caller_tenant := public.current_tenant_id();
  IF v_caller_tenant IS NULL OR v_caller_tenant <> v_tenant THEN
    RAISE EXCEPTION 'cross_tenant_forbidden' USING ERRCODE = '42501';
  END IF;

  -- Cascata via cliente vinculado (se houver)
  SELECT array_agg(id) INTO v_cliente_ids FROM public.clientes WHERE lead_id = p_lead_id;
  IF v_cliente_ids IS NOT NULL THEN
    FOREACH v_cli IN ARRAY v_cliente_ids LOOP
      PERFORM public.delete_cliente_cascade(v_cli);
      v_clientes_apagados := v_clientes_apagados + 1;
    END LOOP;
  END IF;

  -- Vínculos diretos pelo lead
  SELECT array_agg(id) INTO v_proj_ids FROM public.projetos WHERE lead_id = p_lead_id;
  SELECT array_agg(id) INTO v_prop_ids FROM public.propostas_nativas WHERE lead_id = p_lead_id;

  IF v_prop_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_versao_ids FROM public.proposta_versoes WHERE proposta_id = ANY(v_prop_ids);
    IF v_versao_ids IS NOT NULL THEN
      UPDATE public.proposta_versoes SET substituida_por = NULL
       WHERE substituida_por = ANY(v_versao_ids) OR id = ANY(v_versao_ids);
      DELETE FROM public.vendas_transacional WHERE versao_id = ANY(v_versao_ids);
    END IF;
    DELETE FROM public.vendas_transacional WHERE proposta_id = ANY(v_prop_ids);
  END IF;

  IF v_proj_ids IS NOT NULL THEN
    SELECT array_agg(deal_id) INTO v_deal_ids FROM public.projetos WHERE id = ANY(v_proj_ids) AND deal_id IS NOT NULL;
    UPDATE public.projetos SET funil_id=NULL, etapa_id=NULL, deal_id=NULL, proposta_id=NULL WHERE id = ANY(v_proj_ids);
  END IF;

  IF v_deal_ids IS NOT NULL THEN
    DELETE FROM public.deals WHERE id = ANY(v_deal_ids);
  END IF;

  IF v_proj_ids IS NOT NULL THEN
    DELETE FROM public.projetos WHERE id = ANY(v_proj_ids);
  END IF;
  IF v_prop_ids IS NOT NULL THEN
    DELETE FROM public.propostas_nativas WHERE id = ANY(v_prop_ids);
  END IF;

  -- Tabelas que apontam pro lead sem CASCADE
  DELETE FROM public.orcamentos WHERE lead_id = p_lead_id;
  DELETE FROM public.simulacoes WHERE lead_id = p_lead_id;
  DELETE FROM public.facebook_leads WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_atividades WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_distribution_log WHERE lead_id = p_lead_id;
  DELETE FROM public.servicos_agendados WHERE lead_id = p_lead_id;
  DELETE FROM public.visitas_tecnicas WHERE lead_id = p_lead_id;
  DELETE FROM public.sla_breaches WHERE lead_id = p_lead_id;
  DELETE FROM public.intelligence_realtime_notifications WHERE lead_id = p_lead_id;
  DELETE FROM public.checklists_cliente WHERE lead_id = p_lead_id;
  DELETE FROM public.generated_documents WHERE lead_id = p_lead_id;
  DELETE FROM public.whatsapp_automation_logs WHERE lead_id = p_lead_id;

  -- ✅ FK crítica: vendas.orcamento_id → leads.id (sem CASCADE)
  WITH del AS (DELETE FROM public.vendas WHERE orcamento_id = p_lead_id RETURNING 1)
  SELECT COUNT(*) INTO v_vendas_apagadas FROM del;

  DELETE FROM public.leads WHERE id = p_lead_id;

  v_counts := jsonb_build_object(
    'lead_id', p_lead_id,
    'clientes', v_clientes_apagados,
    'projetos', COALESCE(array_length(v_proj_ids,1),0),
    'propostas', COALESCE(array_length(v_prop_ids,1),0),
    'deals', COALESCE(array_length(v_deal_ids,1),0),
    'vendas', v_vendas_apagadas
  );

  INSERT INTO public.cascade_deletion_log (actor_user_id, tenant_id, entity_type, entity_id, counts)
  VALUES (auth.uid(), v_tenant, 'lead', p_lead_id, v_counts);

  RETURN v_counts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_cliente_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_lead_cascade(uuid) TO authenticated;
