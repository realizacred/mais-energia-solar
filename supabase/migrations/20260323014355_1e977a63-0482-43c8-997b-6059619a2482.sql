
-- 1. Add is_principal column to projetos
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS is_principal boolean NOT NULL DEFAULT false;

-- 2. Drop the old unique constraint that blocks multiple active projects per client
DROP INDEX IF EXISTS idx_projetos_unique_cliente_ativo;

-- 3. Add new unique constraint: only one principal project per client
CREATE UNIQUE INDEX idx_projetos_unique_principal_per_cliente
ON public.projetos (cliente_id)
WHERE is_principal = true;

-- 4. Set existing active projects as principal (one per client, most recent)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY cliente_id ORDER BY created_at DESC) AS rn
  FROM projetos
  WHERE status IN ('criado', 'aguardando_documentacao', 'em_analise', 'aprovado', 'em_instalacao')
)
UPDATE projetos SET is_principal = true
WHERE id IN (SELECT id FROM ranked WHERE rn = 1);

-- 5. Update the RPC to auto-set is_principal on new projects
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL::uuid,
  p_projeto_id uuid DEFAULT NULL::uuid,
  p_deal_id uuid DEFAULT NULL::uuid,
  p_origem text DEFAULT 'native'::text,
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb,
  p_cliente_nome text DEFAULT NULL::text,
  p_cliente_telefone text DEFAULT NULL::text,
  p_cliente_email text DEFAULT NULL::text,
  p_cliente_cpf_cnpj text DEFAULT NULL::text,
  p_cliente_empresa text DEFAULT NULL::text,
  p_cliente_cep text DEFAULT NULL::text,
  p_cliente_estado text DEFAULT NULL::text,
  p_cliente_cidade text DEFAULT NULL::text,
  p_cliente_rua text DEFAULT NULL::text,
  p_cliente_numero text DEFAULT NULL::text,
  p_cliente_bairro text DEFAULT NULL::text,
  p_cliente_complemento text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
  v_projeto_id uuid;
  v_deal_id uuid;
  v_cliente_id uuid;
  v_grupo text;
  v_geracao_mensal numeric;
  v_cliente_nome_final text;
BEGIN
  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  v_grupo := p_snapshot->>'grupo';
  IF v_grupo IS NOT NULL THEN
    v_grupo := CASE
      WHEN v_grupo LIKE 'A%' THEN 'A'
      WHEN v_grupo LIKE 'B%' THEN 'B'
      ELSE NULL
    END;
  END IF;

  v_geracao_mensal := (p_snapshot->>'geracaoMensalEstimada')::numeric;
  IF v_geracao_mensal IS NULL AND p_potencia_kwp > 0 THEN
    v_geracao_mensal := ROUND(p_potencia_kwp * COALESCE((p_snapshot->>'locIrradiacao')::numeric, 4.5) * 30 * 0.80);
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    SELECT proj.cliente_id INTO v_cliente_id
    FROM projetos proj WHERE proj.id = v_projeto_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_nome_final := COALESCE(NULLIF(btrim(p_cliente_nome), ''), 'Cliente Rascunho');
    
    v_cliente_id := public.get_or_create_cliente(
      p_nome := v_cliente_nome_final,
      p_telefone := COALESCE(NULLIF(btrim(p_cliente_telefone), ''), '00000000000'),
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

  -- If no projeto_id, create one and set as principal
  IF v_projeto_id IS NULL THEN
    -- If client has no principal yet, this one becomes principal automatically
    -- If client already has a principal, this one is NOT principal (user can toggle later)
    INSERT INTO projetos (tenant_id, lead_id, cliente_id, status, is_principal)
    VALUES (
      v_tenant_id, p_lead_id, v_cliente_id, 'criado',
      NOT EXISTS (SELECT 1 FROM projetos WHERE cliente_id = v_cliente_id AND is_principal = true)
    )
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
    potencia_kwp, valor_total, grupo, geracao_mensal, economia_mensal, snapshot
  ) VALUES (
    v_tenant_id, v_proposta_id, 1, 'draft',
    p_potencia_kwp, p_valor_total, v_grupo, v_geracao_mensal, NULL, p_snapshot
  ) RETURNING id INTO v_versao_id;

  RETURN jsonb_build_object(
    'proposta_id', v_proposta_id,
    'versao_id', v_versao_id,
    'projeto_id', v_projeto_id,
    'deal_id', v_deal_id,
    'cliente_id', v_cliente_id
  );
END;
$function$;

-- 6. Helper function to toggle principal project
CREATE OR REPLACE FUNCTION public.set_projeto_principal(p_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = auth.uid();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant não encontrado'; END IF;

  SELECT cliente_id INTO v_cliente_id FROM projetos WHERE id = p_projeto_id AND tenant_id = v_tenant_id;
  IF v_cliente_id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;

  -- Unset previous principal for this client
  UPDATE projetos SET is_principal = false WHERE cliente_id = v_cliente_id AND is_principal = true AND tenant_id = v_tenant_id;
  
  -- Set new principal
  UPDATE projetos SET is_principal = true WHERE id = p_projeto_id AND tenant_id = v_tenant_id;
END;
$$;
