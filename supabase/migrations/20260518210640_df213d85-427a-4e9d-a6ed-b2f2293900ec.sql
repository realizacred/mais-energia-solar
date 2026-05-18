CREATE OR REPLACE FUNCTION public.archive_lead(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_has_won_deal boolean;
  v_has_accepted_proposal boolean;
  v_lead_nome text;
BEGIN
  -- 1. Obter tenant e dados básicos
  SELECT tenant_id, nome INTO v_tenant_id, v_lead_nome 
  FROM public.leads 
  WHERE id = p_lead_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead não encontrado');
  END IF;

  -- 2. Validar permissão (tenant guard)
  IF v_tenant_id <> (SELECT public.current_tenant_id()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- 3. Verificar impedimentos: Deal WON
  SELECT EXISTS (
    SELECT 1 FROM public.deals d
    JOIN public.clientes c ON c.id = d.customer_id
    WHERE c.lead_id = p_lead_id AND d.status = 'won'
  ) INTO v_has_won_deal;

  IF v_has_won_deal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível arquivar um lead com venda (Deal) concluída.');
  END IF;

  -- 4. Verificar impedimentos: Proposta ACCEPTED
  SELECT EXISTS (
    SELECT 1 FROM public.proposta_versoes pv
    JOIN public.propostas_nativas p ON p.id = pv.proposta_id
    WHERE p.lead_id = p_lead_id AND pv.status = 'accepted'
  ) INTO v_has_accepted_proposal;

  IF v_has_accepted_proposal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível arquivar um lead com proposta aceita.');
  END IF;

  -- 5. Executar Soft Delete
  UPDATE public.leads
  SET 
    deleted_at = now(),
    deleted_by = auth.uid()
  WHERE id = p_lead_id;

  -- 6. Log de auditoria (se a tabela existir)
  BEGIN
    INSERT INTO public.lead_audit_log (lead_id, actor_id, action, details)
    VALUES (p_lead_id, auth.uid(), 'archive', 'Lead arquivado pelo usuário');
  EXCEPTION WHEN OTHERS THEN
    -- Ignora se a tabela de log não existir ou falhar
  END;

  RETURN jsonb_build_object('success', true, 'message', 'Lead arquivado com sucesso');
END;
$$;