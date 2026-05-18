CREATE OR REPLACE FUNCTION public.proposal_delete(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_user_email text;
  v_deal_id uuid;
  v_projeto_id uuid;
  v_is_principal boolean;
  v_current_status text;
  v_old_value numeric;
  v_old_kwp numeric;
  v_new_value numeric := 0;
  v_new_kwp numeric := 0;
  v_next_proposta_id uuid;
  v_next_version_id uuid;
  v_invalidated_tokens integer := 0;
  v_deleted_checklists integer := 0;
  v_removed_pipelines integer := 0;
  v_dependencies text[];
BEGIN
  -- 1. Context & Security
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_tenant');
  END IF;

  -- 2. Fetch current state
  SELECT 
    p.deal_id, 
    p.projeto_id, 
    p.is_principal, 
    p.status,
    pv.valor_total,
    pv.potencia_kwp
  INTO 
    v_deal_id, 
    v_projeto_id, 
    v_is_principal, 
    v_current_status,
    v_old_value,
    v_old_kwp
  FROM propostas_nativas p
  LEFT JOIN proposta_versoes pv ON pv.proposta_id = p.id AND pv.versao_numero = p.versao_atual
  WHERE p.id = p_proposta_id
    AND p.tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_current_status = 'excluida' THEN
    RETURN jsonb_build_object('error', 'already_deleted');
  END IF;

  -- 3. HARD LOCK CHECK
  v_dependencies := public.check_proposal_dependencies(p_proposta_id);
  IF array_length(v_dependencies, 1) > 0 THEN
    RETURN jsonb_build_object(
      'error', 'hard_lock_active',
      'message', 'Proposta possui movimentações financeiras ou operacionais e não pode ser excluída.',
      'dependencies', v_dependencies
    );
  END IF;

  -- 4. Atomic Soft Delete the proposal
  UPDATE propostas_nativas
     SET status = 'excluida',
         deleted_at = now(),
         is_principal = false,
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 5. Invalidate tokens
  UPDATE proposta_aceite_tokens
     SET invalidado_em = now(),
         motivo_invalidacao = 'proposta_excluida'
   WHERE proposta_id = p_proposta_id
     AND invalidado_em IS NULL;
  
  GET DIAGNOSTICS v_invalidated_tokens = ROW_COUNT;

  -- 6. Find Next Best Proposal to be Principal
  SELECT p.id, pv.id, pv.valor_total, pv.potencia_kwp
  INTO v_next_proposta_id, v_next_version_id, v_new_value, v_new_kwp
  FROM propostas_nativas p
  JOIN proposta_versoes pv ON pv.proposta_id = p.id AND pv.versao_numero = p.versao_atual
  WHERE (p.deal_id = v_deal_id OR (v_deal_id IS NULL AND p.projeto_id = v_projeto_id))
    AND p.id != p_proposta_id
    AND p.status != 'excluida'
    AND p.tenant_id = v_tenant_id
  ORDER BY 
    CASE p.status 
      WHEN 'aceita' THEN 1
      WHEN 'enviada' THEN 2
      WHEN 'gerada' THEN 3
      ELSE 4 
    END ASC,
    p.created_at DESC
  LIMIT 1;

  IF v_next_proposta_id IS NOT NULL THEN
    UPDATE propostas_nativas
       SET is_principal = true,
           updated_at = now()
     WHERE id = v_next_proposta_id;
  END IF;

  -- 7. Synchronize Deal & Project values
  IF v_deal_id IS NOT NULL THEN
    UPDATE deals
       SET value = COALESCE(v_new_value, 0),
           kwp = COALESCE(v_new_kwp, 0),
           updated_at = now()
     WHERE id = v_deal_id
       AND tenant_id = v_tenant_id;
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    UPDATE projetos
       SET valor_total = COALESCE(v_new_value, 0),
           potencia_kwp = COALESCE(v_new_kwp, 0),
           updated_at = now()
     WHERE id = v_projeto_id
       AND tenant_id = v_tenant_id;
  END IF;

  -- 8. Operational Cleanup
  IF v_deal_id IS NOT NULL OR v_projeto_id IS NOT NULL THEN
    IF v_next_proposta_id IS NULL THEN
       DELETE FROM checklists_instalador
        WHERE (projeto_id = v_deal_id OR projeto_id = v_projeto_id)
          AND tenant_id = v_tenant_id;
       GET DIAGNOSTICS v_deleted_checklists = ROW_COUNT;

       DELETE FROM deal_pipeline_stages
        WHERE (deal_id = v_deal_id OR deal_id = v_projeto_id)
          AND pipeline_id IN (
            SELECT id FROM pipelines
             WHERE lower(name) != 'comercial'
               AND tenant_id = v_tenant_id
          );
       GET DIAGNOSTICS v_removed_pipelines = ROW_COUNT;
    END IF;
  END IF;

  -- 9. Audit Log REMOVED - Triggers handle this now
  
  RETURN jsonb_build_object(
    'success', true,
    'proposta_id', p_proposta_id,
    'new_principal_id', v_next_proposta_id,
    'new_value', v_new_value
  );
END;
$function$;