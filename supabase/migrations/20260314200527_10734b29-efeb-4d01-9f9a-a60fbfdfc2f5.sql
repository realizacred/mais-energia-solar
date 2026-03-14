
-- ═══════════════════════════════════════════════════════════════
-- RPC: approve_venda_with_composition
-- Atomic approval: creates venda + saves composition + updates status
-- All-or-nothing transaction — no partial state possible
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_venda_with_composition(
  p_cliente_id       UUID,
  p_lead_id          UUID DEFAULT NULL,
  p_valor_total      NUMERIC DEFAULT 0,
  p_status_convertido_id UUID DEFAULT NULL,
  p_observacoes      TEXT DEFAULT NULL,
  p_itens            JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venda_id       UUID;
  v_pagamento_id   UUID;
  v_tenant         UUID;
  v_item           JSONB;
  v_parcela        JSONB;
  v_item_id        UUID;
BEGIN
  -- Get tenant from client
  SELECT tenant_id INTO v_tenant FROM clientes WHERE id = p_cliente_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
  END IF;

  -- 1. Check no existing approved venda for this client+lead to prevent duplicates
  IF EXISTS (
    SELECT 1 FROM vendas 
    WHERE cliente_id = p_cliente_id 
      AND (p_lead_id IS NULL OR orcamento_id = p_lead_id)
      AND status IN ('aprovada', 'finalizada')
  ) THEN
    RAISE EXCEPTION 'Já existe uma venda aprovada para este cliente/lead';
  END IF;

  -- 2. Create venda record
  INSERT INTO vendas (
    tenant_id, cliente_id, orcamento_id,
    valor_total_bruto, valor_total_liquido,
    status, observacoes, created_by
  ) VALUES (
    v_tenant, p_cliente_id, p_lead_id,
    p_valor_total, p_valor_total,
    'aprovada', p_observacoes, auth.uid()
  )
  RETURNING id INTO v_venda_id;

  -- 3. Save payment composition if items provided
  IF jsonb_array_length(p_itens) > 0 THEN
    INSERT INTO venda_pagamentos (
      tenant_id, venda_id, observacoes, versao, status_validacao
    ) VALUES (
      v_tenant, v_venda_id, p_observacoes, 1, 'valido'
    )
    RETURNING id INTO v_pagamento_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      INSERT INTO venda_pagamento_itens (
        tenant_id, pagamento_id,
        forma_pagamento, valor_base, entrada,
        data_pagamento, data_primeiro_vencimento,
        parcelas, intervalo_dias,
        juros_tipo, juros_valor, juros_responsavel,
        observacoes, metadata_json
      ) VALUES (
        v_tenant, v_pagamento_id,
        (v_item->>'forma_pagamento')::forma_pagamento_enum,
        (v_item->>'valor_base')::NUMERIC,
        COALESCE((v_item->>'entrada')::BOOLEAN, false),
        NULLIF(v_item->>'data_pagamento', ''),
        NULLIF(v_item->>'data_primeiro_vencimento', ''),
        COALESCE((v_item->>'parcelas')::INT, 1),
        COALESCE((v_item->>'intervalo_dias')::INT, 30),
        COALESCE((v_item->>'juros_tipo')::juros_tipo_enum, 'sem_juros'),
        COALESCE((v_item->>'juros_valor')::NUMERIC, 0),
        COALESCE((v_item->>'juros_responsavel')::juros_responsavel_enum, 'nao_aplica'),
        NULLIF(v_item->>'observacoes', ''),
        COALESCE((v_item->'metadata_json')::JSONB, '{}'::JSONB)
      )
      RETURNING id INTO v_item_id;

      -- Insert parcelas
      IF v_item->'parcelas_detalhes' IS NOT NULL THEN
        FOR v_parcela IN SELECT * FROM jsonb_array_elements(v_item->'parcelas_detalhes')
        LOOP
          INSERT INTO venda_pagamento_parcelas (
            tenant_id, item_id,
            numero_parcela, tipo_parcela,
            valor, vencimento, status
          ) VALUES (
            v_tenant, v_item_id,
            (v_parcela->>'numero_parcela')::INT,
            (v_parcela->>'tipo_parcela')::tipo_parcela_enum,
            (v_parcela->>'valor')::NUMERIC,
            (v_parcela->>'vencimento')::DATE,
            'pendente'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 4. Update lead status to "Convertido" (only AFTER venda + composition succeed)
  IF p_lead_id IS NOT NULL AND p_status_convertido_id IS NOT NULL THEN
    UPDATE leads SET status_id = p_status_convertido_id WHERE id = p_lead_id;
    UPDATE orcamentos SET status_id = p_status_convertido_id WHERE lead_id = p_lead_id;
  END IF;

  -- 5. Update client valor_projeto
  IF p_valor_total > 0 THEN
    UPDATE clientes SET valor_projeto = p_valor_total WHERE id = p_cliente_id;
  END IF;

  RETURN v_venda_id;
END;
$$;
