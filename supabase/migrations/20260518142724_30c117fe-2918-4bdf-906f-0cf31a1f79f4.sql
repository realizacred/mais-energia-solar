CREATE OR REPLACE FUNCTION public.convert_lead_to_venda_v2(
  _lead_id uuid,
  _payload jsonb,
  _payment_composition jsonb,
  _idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_cliente_id UUID;
    v_projeto_id UUID;
    v_deal_id UUID;
    v_convertido_status_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_tenant_id UUID;
    v_cpf_cnpj TEXT;
    v_email TEXT;
    v_telefone TEXT;
    v_telefone_normalized TEXT;
    v_nome TEXT;
    v_valor_projeto NUMERIC;
    v_funil_id UUID;
    v_etapa_id UUID;
    v_pipeline_id UUID;
    v_stage_id UUID;
    v_consultor_id UUID;
BEGIN
    -- 1. Resolver tenant
    v_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM leads WHERE id = _lead_id;
    END IF;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível identificar o tenant da conversão.';
    END IF;

    -- 2. Normalizar chaves de deduplicação
    v_nome := NULLIF(BTRIM(_payload->>'nome'), '');
    v_cpf_cnpj := NULLIF(regexp_replace(COALESCE(_payload->>'cpf_cnpj', ''), '\D', '', 'g'), '');
    v_email := NULLIF(LOWER(BTRIM(_payload->>'email')), '');
    v_telefone := NULLIF(BTRIM(_payload->>'telefone'), '');
    v_telefone_normalized := public.canonical_phone_digits(v_telefone);
    v_valor_projeto := NULLIF(_payload->>'valor_projeto', '')::numeric;
    v_consultor_id := NULLIF(_payload->>'consultor_id', '')::uuid;

    -- 3. Idempotência e deduplicação forte (Cliente)
    SELECT c.id INTO v_cliente_id
    FROM clientes c
    WHERE c.tenant_id = v_tenant_id
      AND (
        c.lead_id = _lead_id
        OR (_idempotency_key IS NOT NULL AND c.external_id = _idempotency_key)
        OR (v_cpf_cnpj IS NOT NULL AND regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g') = v_cpf_cnpj)
        OR (v_email IS NOT NULL AND LOWER(BTRIM(COALESCE(c.email, ''))) = v_email)
        OR (v_telefone_normalized IS NOT NULL AND c.telefone_normalized = v_telefone_normalized)
      )
    ORDER BY
      CASE
        WHEN c.lead_id = _lead_id THEN 1
        WHEN _idempotency_key IS NOT NULL AND c.external_id = _idempotency_key THEN 2
        WHEN v_cpf_cnpj IS NOT NULL AND regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g') = v_cpf_cnpj THEN 3
        WHEN v_email IS NOT NULL AND LOWER(BTRIM(COALESCE(c.email, ''))) = v_email THEN 4
        WHEN v_telefone_normalized IS NOT NULL AND c.telefone_normalized = v_telefone_normalized THEN 5
        ELSE 99
      END,
      c.updated_at DESC
    LIMIT 1;

    -- Fallback SolarMarket (Nomes)
    IF v_cliente_id IS NULL AND v_nome IS NOT NULL THEN
      SELECT c.id INTO v_cliente_id
      FROM clientes c
      WHERE c.tenant_id = v_tenant_id
        AND c.external_source = 'solarmarket'
        AND NULLIF(c.telefone_normalized, '') IS NULL
        AND NULLIF(c.email, '') IS NULL
        AND NULLIF(c.cpf_cnpj, '') IS NULL
        AND length(BTRIM(c.nome)) >= 8
        AND (LOWER(v_nome) LIKE LOWER(BTRIM(c.nome)) || '%' OR LOWER(BTRIM(c.nome)) LIKE LOWER(v_nome) || '%')
      ORDER BY length(BTRIM(c.nome)) DESC, c.created_at DESC
      LIMIT 1;
    END IF;

    -- 4. Criar ou Atualizar Cliente
    IF v_cliente_id IS NOT NULL THEN
        UPDATE clientes SET
            lead_id = COALESCE(lead_id, _lead_id),
            nome = COALESCE(v_nome, nome),
            telefone = COALESCE(v_telefone, telefone),
            email = COALESCE(v_email, email),
            cpf_cnpj = COALESCE(v_cpf_cnpj, cpf_cnpj),
            cep = COALESCE(NULLIF(_payload->>'cep', ''), cep),
            estado = COALESCE(NULLIF(_payload->>'estado', ''), estado),
            cidade = COALESCE(NULLIF(_payload->>'cidade', ''), cidade),
            bairro = COALESCE(NULLIF(_payload->>'bairro', ''), bairro),
            rua = COALESCE(NULLIF(_payload->>'rua', ''), rua),
            numero = COALESCE(NULLIF(_payload->>'numero', ''), numero),
            potencia_kwp = COALESCE(NULLIF(_payload->>'potencia_kwp', '')::numeric, potencia_kwp),
            valor_projeto = COALESCE(v_valor_projeto, valor_projeto),
            updated_at = v_now
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO clientes (
            lead_id, nome, telefone, email, cpf_cnpj, 
            cep, estado, cidade, bairro, rua, numero,
            tenant_id, external_id, created_at, updated_at
        ) VALUES (
            _lead_id, v_nome, v_telefone, v_email, v_cpf_cnpj,
            NULLIF(_payload->>'cep', ''), NULLIF(_payload->>'estado', ''), NULLIF(_payload->>'cidade', ''), 
            NULLIF(_payload->>'bairro', ''), NULLIF(_payload->>'rua', ''), NULLIF(_payload->>'numero', ''),
            v_tenant_id, _idempotency_key, v_now, v_now
        ) RETURNING id INTO v_cliente_id;
    END IF;

    -- 5. Verificar se já existe Projeto para este Lead/Cliente
    SELECT id, deal_id INTO v_projeto_id, v_deal_id
    FROM projetos
    WHERE (lead_id = _lead_id OR cliente_id = v_cliente_id)
      AND tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- 6. Criar Projeto se não existir
    IF v_projeto_id IS NULL THEN
        -- Resolver Funil Comercial Padrão (RB-61)
        SELECT id INTO v_funil_id FROM projeto_funis WHERE tenant_id = v_tenant_id AND ativo = true AND papel = 'comercial' LIMIT 1;
        IF v_funil_id IS NULL THEN
            SELECT id INTO v_funil_id FROM projeto_funis WHERE tenant_id = v_tenant_id AND ativo = true ORDER BY ordem ASC LIMIT 1;
        END IF;
        
        IF v_funil_id IS NOT NULL THEN
            SELECT id INTO v_etapa_id FROM projeto_etapas WHERE funil_id = v_funil_id ORDER BY ordem ASC LIMIT 1;
        END IF;

        INSERT INTO projetos (
            cliente_id, lead_id, consultor_id, funil_id, etapa_id, 
            status, tenant_id, created_at, updated_at
        ) VALUES (
            v_cliente_id, _lead_id, v_consultor_id, v_funil_id, v_etapa_id,
            'criado', v_tenant_id, v_now, v_now
        ) RETURNING id INTO v_projeto_id;
    END IF;

    -- 7. Criar Deal se não existir
    IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
        -- Resolver Pipeline Comercial (Match por nome do funil ou padrão)
        SELECT p.id INTO v_pipeline_id 
        FROM pipelines p 
        JOIN projeto_funis f ON f.nome ILIKE p.name
        WHERE f.id = v_funil_id AND p.tenant_id = v_tenant_id AND p.is_active = true
        LIMIT 1;

        IF v_pipeline_id IS NULL THEN
            SELECT id INTO v_pipeline_id FROM pipelines WHERE tenant_id = v_tenant_id AND is_active = true AND name ILIKE '%comercial%' LIMIT 1;
        END IF;

        IF v_pipeline_id IS NOT NULL THEN
            SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND is_closed = false ORDER BY position ASC LIMIT 1;
            
            INSERT INTO deals (
                pipeline_id, stage_id, owner_id, customer_id, projeto_id,
                value, title, tenant_id, created_at, updated_at
            ) VALUES (
                v_pipeline_id, v_stage_id, v_consultor_id, v_cliente_id, v_projeto_id,
                COALESCE(v_valor_projeto, 0), v_nome, v_tenant_id, v_now, v_now
            ) RETURNING id INTO v_deal_id;

            -- Vincular deal de volta no projeto
            UPDATE projetos SET deal_id = v_deal_id WHERE id = v_projeto_id;
        END IF;
    END IF;

    -- 8. Atualizar Status do Lead
    SELECT id INTO v_convertido_status_id FROM lead_status WHERE nome IN ('Convertido', 'Aguardando Validação') ORDER BY (nome = 'Convertido') DESC LIMIT 1;
    IF v_convertido_status_id IS NOT NULL THEN
        UPDATE leads SET status_id = v_convertido_status_id, seen = true, updated_at = v_now WHERE id = _lead_id AND tenant_id = v_tenant_id;
        UPDATE orcamentos SET visto = true, updated_at = v_now WHERE lead_id = _lead_id AND tenant_id = v_tenant_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'id', v_cliente_id, 
        'cliente_id', v_cliente_id,
        'projeto_id', v_projeto_id,
        'deal_id', v_deal_id
    );
END;
$function$;