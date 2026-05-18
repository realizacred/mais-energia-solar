CREATE OR REPLACE FUNCTION public.check_proposal_dependencies(p_proposta_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_projeto_id uuid;
  v_deal_id uuid;
  v_has_pagamento boolean;
  v_has_obra boolean;
  v_has_cheque boolean;
  v_deps text[] := ARRAY[]::text[];
  v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();

  -- 1. Get proposal context
  SELECT projeto_id, deal_id 
  INTO v_projeto_id, v_deal_id
  FROM propostas_nativas
  WHERE id = p_proposta_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN RETURN v_deps; END IF;

  -- 2. Check for payments (Lancamentos Financeiros)
  IF v_projeto_id IS NOT NULL OR v_deal_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM lancamentos_financeiros 
      WHERE (projeto_id = v_projeto_id OR projeto_id = v_deal_id)
        AND status = 'pago'
        AND tenant_id = v_tenant_id
    ) INTO v_has_pagamento;
    IF v_has_pagamento THEN v_deps := array_append(v_deps, 'Pagamentos Efetuados'); END IF;
  END IF;

  -- 4. Check for Obra
  IF v_projeto_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM obras 
      WHERE projeto_id = v_projeto_id
        AND tenant_id = v_tenant_id
    ) INTO v_has_obra;
    IF v_has_obra THEN v_deps := array_append(v_deps, 'Obra/Instalação Iniciada'); END IF;
  END IF;

  -- 5. Check cheques (linked checks)
  IF v_projeto_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM cheques 
      WHERE projeto_id = v_projeto_id
        AND status NOT IN ('devolvido', 'sustado', 'cancelado')
        AND tenant_id = v_tenant_id
    ) INTO v_has_cheque;
    IF v_has_cheque THEN v_deps := array_append(v_deps, 'Cheques Vinculados'); END IF;
  END IF;

  RETURN v_deps;
END;
$function$;

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
  v_current_status text;
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
    p.status
  INTO 
    v_deal_id, 
    v_projeto_id, 
    v_current_status
  FROM propostas_nativas p
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
     SET status = 'excluida'::proposta_nativa_status,
         deleted_at = now(),
         is_principal = false,
         updated_at = now()
   WHERE id = p_proposta_id
     AND tenant_id = v_tenant_id;

  -- 5. Invalidate tokens
  UPDATE proposta_aceite_tokens
     SET invalidado_em = now()
   WHERE proposta_id = p_proposta_id;

  -- Removed direct audit_logs insert as triggers handle it.

  RETURN jsonb_build_object(
    'success', true,
    'id', p_proposta_id,
    'status', 'excluida'
  );
END;
$function$;