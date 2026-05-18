CREATE OR REPLACE FUNCTION public.convert_lead_to_venda_v2(_lead_id uuid, _payload jsonb, _payment_composition jsonb, _idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_cliente_id UUID;
    v_convertido_status_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_tenant_id UUID;
    v_cpf_cnpj TEXT;
    v_email TEXT;
    v_telefone TEXT;
BEGIN
    -- 1. Validar Tenant
    v_tenant_id := auth.jwt() ->> 'tenant_id';
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id FROM leads WHERE id = _lead_id;
    END IF;

    -- 2. Idempotência: Verificar se já existe venda para este lead
    SELECT id INTO v_cliente_id FROM clientes WHERE lead_id = _lead_id OR (external_id = _idempotency_key AND _idempotency_key IS NOT NULL);
    IF v_cliente_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'id', v_cliente_id, 'message', 'Venda já processada anteriormente');
    END IF;

    -- 3. Verificar existência de cliente por dados únicos antes de inserir
    v_cpf_cnpj := NULLIF(TRIM(_payload->>'cpf_cnpj'), '');
    v_email := NULLIF(TRIM(_payload->>'email'), '');
    v_telefone := NULLIF(TRIM(_payload->>'telefone'), '');

    SELECT id INTO v_cliente_id 
    FROM clientes 
    WHERE tenant_id = v_tenant_id
      AND (
        (v_cpf_cnpj IS NOT NULL AND cpf_cnpj = v_cpf_cnpj)
        OR (v_email IS NOT NULL AND email = v_email)
        OR (v_telefone IS NOT NULL AND telefone = v_telefone)
      )
    LIMIT 1;

    -- 4. Validar Regras de Negócio (exemplo: valor > 0)
    IF (_payload->>'valor_projeto')::NUMERIC <= 0 THEN
        RAISE EXCEPTION 'O valor da venda deve ser maior que zero.';
    END IF;

    -- 5. Upsert Cliente (ou Update se já existir por lead_id ou dados únicos)
    IF v_cliente_id IS NOT NULL THEN
        UPDATE clientes SET
            lead_id = _lead_id,
            nome = COALESCE(_payload->>'nome', nome),
            telefone = COALESCE(_payload->>'telefone', telefone),
            email = COALESCE(_payload->>'email', email),
            cpf_cnpj = COALESCE(_payload->>'cpf_cnpj', cpf_cnpj),
            payment_composition = _payment_composition,
            updated_at = v_now
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO clientes (
            lead_id,
            nome, telefone, email, cpf_cnpj, data_nascimento,
            cep, estado, cidade, bairro, rua, numero, complemento,
            disjuntor_id, transformador_id, localizacao, observacoes,
            identidade_urls, comprovante_endereco_urls, comprovante_beneficiaria_urls,
            simulacao_aceita_id, assinatura_url, potencia_kwp, valor_projeto,
            payment_composition, tenant_id, external_id, created_at, updated_at
        ) VALUES (
            _lead_id,
            _payload->>'nome',
            _payload->>'telefone',
            _payload->>'email',
            _payload->>'cpf_cnpj',
            (_payload->>'data_nascimento')::DATE,
            _payload->>'cep',
            _payload->>'estado',
            _payload->>'cidade',
            _payload->>'bairro',
            _payload->>'rua',
            _payload->>'numero',
            _payload->>'complemento',
            (_payload->>'disjuntor_id')::UUID,
            (_payload->>'transformador_id')::UUID,
            _payload->>'localizacao',
            _payload->>'observacoes',
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'identidade_urls', '[]'::jsonb))),
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_endereco_urls', '[]'::jsonb))),
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_beneficiaria_urls', '[]'::jsonb))),
            (_payload->>'simulacao_aceita_id')::UUID,
            _payload->>'assinatura_url',
            (_payload->>'potencia_kwp')::NUMERIC,
            (_payload->>'valor_projeto')::NUMERIC,
            _payment_composition,
            v_tenant_id,
            _idempotency_key,
            v_now,
            v_now
        )
        RETURNING id INTO v_cliente_id;
    END IF;

    -- 6. Atualizar Status do Lead e Orçamento
    SELECT id INTO v_convertido_status_id FROM lead_status WHERE nome = 'Aguardando Validação' LIMIT 1;
    
    IF v_convertido_status_id IS NOT NULL THEN
        UPDATE leads SET status_id = v_convertido_status_id, updated_at = v_now WHERE id = _lead_id;
        UPDATE orcamentos SET status_id = v_convertido_status_id, ultimo_contato = v_now, updated_at = v_now WHERE lead_id = _lead_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_cliente_id);
END;
$function$;
