
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_deal_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'native',
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb,
  p_cliente_nome text DEFAULT NULL,
  p_cliente_telefone text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_cliente_cpf_cnpj text DEFAULT NULL,
  p_cliente_empresa text DEFAULT NULL,
  p_cliente_cep text DEFAULT NULL,
  p_cliente_estado text DEFAULT NULL,
  p_cliente_cidade text DEFAULT NULL,
  p_cliente_rua text DEFAULT NULL,
  p_cliente_numero text DEFAULT NULL,
  p_cliente_bairro text DEFAULT NULL,
  p_cliente_complemento text DEFAULT NULL
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
  v_cliente_id uuid;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  IF p_cliente_nome IS NOT NULL AND btrim(p_cliente_nome) <> '' 
     AND p_cliente_telefone IS NOT NULL AND btrim(p_cliente_telefone) <> '' THEN
    v_cliente_id := public.get_or_create_cliente(
      p_nome := p_cliente_nome,
      p_telefone := p_cliente_telefone,
      p_email := p_cliente_email,
      p_cpf_cnpj := p_cliente_cpf_cnpj,
      p_empresa := p_cliente_empresa,
      p_cep := p_cliente_cep,
      p_estado := p_cliente_estado,
      p_cidade := p_cliente_cidade,
      p_rua := p_cliente_rua,
      p_numero := p_cliente_numero,
      p_bairro := p_cliente_bairro,
      p_complemento := p_cliente_complemento
    );
  END IF;

  -- Fix: use valid enum value 'aguardando_documentacao' instead of 'prospeccao'
  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (tenant_id, lead_id, codigo, status)
    VALUES (v_tenant_id, p_lead_id, p_titulo, 'aguardando_documentacao')
    RETURNING id INTO v_projeto_id;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id
    FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  INSERT INTO propostas_nativas (
    tenant_id, titulo, lead_id, cliente_id, projeto_id, deal_id, origem, status
  ) VALUES (
    v_tenant_id, p_titulo, p_lead_id, v_cliente_id, v_projeto_id, v_deal_id, p_origem, 'rascunho'
  ) RETURNING id INTO v_proposta_id;

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
    'deal_id', v_deal_id,
    'cliente_id', v_cliente_id
  );
END;
$$;
