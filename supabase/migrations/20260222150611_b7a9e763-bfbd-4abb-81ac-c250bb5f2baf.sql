-- Add deal_id to projetos to link deals ↔ projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_projetos_deal_id ON public.projetos(deal_id);

-- Update RPC to accept and store deal_id
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'native',
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb,
  p_deal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Perfil ou tenant não encontrado';
  END IF;

  -- 1) Try to find existing projeto by p_projeto_id
  IF p_projeto_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id
    FROM projetos WHERE id = p_projeto_id AND tenant_id = v_tenant_id;
  END IF;

  -- 2) If not found, try to find by deal_id
  IF v_projeto_id IS NULL AND p_deal_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id
    FROM projetos WHERE deal_id = p_deal_id AND tenant_id = v_tenant_id
    LIMIT 1;
  END IF;

  -- 3) If still not found, create new projeto linked to deal
  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, lead_id, deal_id, created_by, status, potencia_kwp, observacoes)
    VALUES (v_tenant_id, p_lead_id, p_deal_id, v_user_id, 'aguardando_documentacao', p_potencia_kwp, 'Projeto criado automaticamente via proposta')
    RETURNING id INTO v_projeto_id;
  END IF;

  INSERT INTO propostas_nativas (tenant_id, titulo, lead_id, projeto_id, status, origem, created_by)
  VALUES (v_tenant_id, COALESCE(NULLIF(p_titulo,''), 'Proposta sem título'), p_lead_id, v_projeto_id, 'rascunho', p_origem, v_user_id)
  RETURNING id INTO v_proposta_id;

  INSERT INTO proposta_versoes (tenant_id, proposta_id, versao_numero, status, potencia_kwp, valor_total, snapshot)
  VALUES (v_tenant_id, v_proposta_id, 1, 'draft', p_potencia_kwp, p_valor_total, p_snapshot)
  RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object('proposta_id', v_proposta_id, 'versao_id', v_versao_id, 'projeto_id', v_projeto_id);
END;
$$;