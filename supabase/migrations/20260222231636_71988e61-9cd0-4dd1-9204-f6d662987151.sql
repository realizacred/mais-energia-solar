
-- Drop all 3 overloads to clean up
DROP FUNCTION IF EXISTS public.create_proposta_nativa_atomic(text, uuid, uuid, text, numeric, numeric, jsonb);
DROP FUNCTION IF EXISTS public.create_proposta_nativa_atomic(text, uuid, uuid, text, numeric, numeric, jsonb, uuid);
DROP FUNCTION IF EXISTS public.create_proposta_nativa_atomic(text, uuid, uuid, uuid, text, numeric, numeric, jsonb);

-- Recreate single canonical version with p_deal_id
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_deal_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'native',
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
  v_projeto_id uuid;
  v_deal_id uuid;
BEGIN
  -- Resolve tenant from auth user
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  -- If no projeto_id, create one
  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, lead_id, nome, status)
    VALUES (v_tenant_id, p_lead_id, p_titulo, 'prospeccao')
    RETURNING id INTO v_projeto_id;
  END IF;

  -- If no deal_id, try to find or create from projeto
  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id
    FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  -- Create proposta
  INSERT INTO propostas_nativas (
    tenant_id, titulo, lead_id, projeto_id, deal_id, origem, status
  ) VALUES (
    v_tenant_id, p_titulo, p_lead_id, v_projeto_id, v_deal_id, p_origem, 'rascunho'
  ) RETURNING id INTO v_proposta_id;

  -- Create versão
  INSERT INTO proposta_versoes (
    tenant_id, proposta_id, versao_numero, status,
    potencia_kwp, valor_total, snapshot
  ) VALUES (
    v_tenant_id, v_proposta_id, 1, 'draft',
    p_potencia_kwp, p_valor_total, p_snapshot
  ) RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object(
    'proposta_id', v_proposta_id,
    'versao_id', v_versao_id,
    'projeto_id', v_projeto_id,
    'deal_id', v_deal_id
  );
END;
$$;
