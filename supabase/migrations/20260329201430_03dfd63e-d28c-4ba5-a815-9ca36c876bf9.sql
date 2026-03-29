-- 1. Add reabrir columns to propostas_nativas
ALTER TABLE propostas_nativas 
  ADD COLUMN IF NOT EXISTS status_anterior proposta_nativa_status,
  ADD COLUMN IF NOT EXISTS reaberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberta_por uuid;

-- 2. Create proposta_historico table
CREATE TABLE IF NOT EXISTS proposta_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES propostas_nativas(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  user_id uuid,
  acao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proposta_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON proposta_historico
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- 3. Create RPC proposal_reabrir
CREATE OR REPLACE FUNCTION proposal_reabrir(
  p_proposta_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposta propostas_nativas%ROWTYPE;
  v_has_admin_role boolean;
  v_status_anterior proposta_nativa_status;
  v_novo_status proposta_nativa_status;
BEGIN
  -- Check if user has admin/gerente/super_admin role
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_user_id 
      AND role IN ('admin'::app_role, 'gerente'::app_role, 'super_admin'::app_role)
  ) INTO v_has_admin_role;

  IF NOT v_has_admin_role THEN
    RETURN jsonb_build_object('error', 'Sem permissão para reabrir propostas. Apenas administradores e gestores podem executar esta ação.');
  END IF;

  -- Fetch proposta
  SELECT * INTO v_proposta FROM propostas_nativas WHERE id = p_proposta_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Proposta não encontrada');
  END IF;

  -- Verify status allows reopening
  IF v_proposta.status NOT IN ('accepted'::proposta_nativa_status, 'rejected'::proposta_nativa_status) THEN
    RETURN jsonb_build_object('error', 'Apenas propostas aceitas ou rejeitadas podem ser reabertas');
  END IF;

  v_status_anterior := v_proposta.status;
  v_novo_status := 'sent'::proposta_nativa_status;

  -- Update proposta
  UPDATE propostas_nativas SET
    status = v_novo_status,
    status_anterior = v_status_anterior,
    reaberta_em = NOW(),
    reaberta_por = p_user_id,
    updated_at = NOW()
  WHERE id = p_proposta_id;

  -- Record in history
  INSERT INTO proposta_historico (
    proposta_id, tenant_id, user_id, acao, dados_anteriores, dados_novos
  ) VALUES (
    p_proposta_id,
    v_proposta.tenant_id,
    p_user_id,
    'reaberta',
    jsonb_build_object('status', v_status_anterior::text),
    jsonb_build_object('status', v_novo_status::text)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status_anterior', v_status_anterior::text,
    'novo_status', v_novo_status::text
  );
END;
$$;