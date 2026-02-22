
-- Fix: if projeto_id is provided but not found, create it instead of failing
CREATE OR REPLACE FUNCTION public.create_proposta_nativa_atomic(
  p_titulo text,
  p_lead_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'native',
  p_potencia_kwp numeric DEFAULT 0,
  p_valor_total numeric DEFAULT 0,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_projeto_id uuid;
  v_proposta_id uuid;
  v_versao_id uuid;
BEGIN
  -- 1) Resolve user + tenant
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p
  WHERE p.user_id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Perfil ou tenant não encontrado para o usuário';
  END IF;

  -- 2) Ensure projeto exists - NEVER fail, always resolve
  IF p_projeto_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id
    FROM projetos
    WHERE id = p_projeto_id AND tenant_id = v_tenant_id;

    -- Log for debugging
    RAISE LOG '[create_proposta_nativa_atomic] projeto_id_enviado=%, tenant_id=%, encontrado=%',
      p_projeto_id, v_tenant_id, (v_projeto_id IS NOT NULL);
  END IF;

  -- If no valid projeto found (null input OR not found), create one
  IF v_projeto_id IS NULL THEN
    INSERT INTO projetos (
      tenant_id,
      lead_id,
      created_by,
      status,
      potencia_kwp,
      observacoes
    ) VALUES (
      v_tenant_id,
      p_lead_id,
      v_user_id,
      'aguardando_documentacao',
      p_potencia_kwp,
      'Projeto criado automaticamente via proposta'
    )
    RETURNING id INTO v_projeto_id;

    RAISE LOG '[create_proposta_nativa_atomic] Projeto criado automaticamente: %', v_projeto_id;
  END IF;

  -- 3) Insert propostas_nativas
  INSERT INTO propostas_nativas (
    tenant_id,
    titulo,
    lead_id,
    projeto_id,
    status,
    origem,
    created_by
  ) VALUES (
    v_tenant_id,
    COALESCE(NULLIF(p_titulo, ''), 'Proposta sem título'),
    p_lead_id,
    v_projeto_id,
    'rascunho',
    p_origem,
    v_user_id
  )
  RETURNING id INTO v_proposta_id;

  -- 4) Insert first versão
  INSERT INTO proposta_versoes (
    tenant_id,
    proposta_id,
    versao_numero,
    status,
    potencia_kwp,
    valor_total,
    snapshot
  ) VALUES (
    v_tenant_id,
    v_proposta_id,
    1,
    'rascunho',
    p_potencia_kwp,
    p_valor_total,
    p_snapshot
  )
  RETURNING id INTO v_versao_id;

  -- 5) Audit log
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    tabela,
    acao,
    registro_id,
    dados_novos
  ) VALUES (
    v_tenant_id,
    v_user_id,
    'propostas_nativas',
    'create_atomic',
    v_proposta_id::text,
    jsonb_build_object(
      'proposta_id', v_proposta_id,
      'projeto_id', v_projeto_id,
      'versao_id', v_versao_id,
      'lead_id', p_lead_id,
      'projeto_id_original', p_projeto_id,
      'projeto_criado', (p_projeto_id IS NULL OR p_projeto_id != v_projeto_id)
    )
  );

  RETURN jsonb_build_object(
    'proposta_id', v_proposta_id,
    'versao_id', v_versao_id,
    'projeto_id', v_projeto_id
  );
END;
$$;

-- Adjust FK to CASCADE
ALTER TABLE propostas_nativas
  DROP CONSTRAINT IF EXISTS propostas_nativas_projeto_id_fkey;

ALTER TABLE propostas_nativas
  ADD CONSTRAINT propostas_nativas_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES projetos(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
