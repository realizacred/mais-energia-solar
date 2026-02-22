
-- Nova função sem ambiguidade de overload
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic_v2(
  p_titulo text,
  p_lead_id uuid,
  p_projeto_id uuid,
  p_deal_id uuid,
  p_origem text,
  p_potencia_kwp numeric,
  p_valor_total numeric,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_projeto_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_tenant_id := require_tenant_id();

  -- 1) Resolve projeto_id
  IF p_projeto_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id
    FROM projetos WHERE id = p_projeto_id AND tenant_id = v_tenant_id;
    IF v_projeto_id IS NULL THEN
      RAISE EXCEPTION 'projeto_id % não encontrado no tenant', p_projeto_id;
    END IF;
  END IF;

  -- 2) Fallback: find projeto by deal_id
  IF v_projeto_id IS NULL AND p_deal_id IS NOT NULL THEN
    -- Validate deal belongs to tenant
    IF NOT EXISTS (SELECT 1 FROM deals WHERE id = p_deal_id AND tenant_id = v_tenant_id) THEN
      RAISE EXCEPTION 'deal_id % não encontrado no tenant', p_deal_id;
    END IF;

    SELECT id INTO v_projeto_id
    FROM projetos WHERE deal_id = p_deal_id AND tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  -- 3) Auto-create projeto if needed
  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, lead_id, deal_id, created_by, status, potencia_kwp, observacoes)
    VALUES (v_tenant_id, p_lead_id, p_deal_id, v_user_id, 'aguardando_documentacao', p_potencia_kwp, 'Projeto criado automaticamente via proposta v2')
    RETURNING id INTO v_projeto_id;
  END IF;

  -- 4) Insert proposta
  INSERT INTO propostas_nativas (tenant_id, titulo, lead_id, projeto_id, deal_id, status, origem, created_by)
  VALUES (v_tenant_id, COALESCE(NULLIF(p_titulo,''), 'Proposta sem título'), p_lead_id, v_projeto_id, p_deal_id, 'rascunho', p_origem, v_user_id)
  RETURNING id INTO v_proposta_id;

  -- 5) Insert first version
  INSERT INTO proposta_versoes (tenant_id, proposta_id, versao_numero, status, potencia_kwp, valor_total, snapshot)
  VALUES (v_tenant_id, v_proposta_id, 1, 'draft', p_potencia_kwp, p_valor_total, p_snapshot)
  RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object('proposta_id', v_proposta_id, 'versao_id', v_versao_id, 'projeto_id', v_projeto_id);
END;
$$;
