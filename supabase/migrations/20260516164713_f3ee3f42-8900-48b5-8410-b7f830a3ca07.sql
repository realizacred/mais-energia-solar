-- 1. Função para estatísticas do consultor
CREATE OR REPLACE FUNCTION public.get_consultor_stats(
    _consultor_id UUID DEFAULT NULL,
    _consultor_nome TEXT DEFAULT NULL,
    _is_admin BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    terminal_status_ids UUID[];
    converted_status_ids UUID[];
BEGIN
    -- Pegar IDs de status terminais e convertidos
    SELECT array_agg(id) INTO terminal_status_ids FROM lead_status 
    WHERE nome ILIKE '%convertido%' OR nome ILIKE '%perdido%' OR nome ILIKE '%cancelado%' 
       OR nome ILIKE '%recusado%' OR nome ILIKE '%inativo%' OR nome ILIKE '%fechado%' 
       OR nome ILIKE '%ganho%' OR nome ILIKE '%cliente%' OR nome ILIKE '%arquivado%'
       OR nome ILIKE '%aguardando validação%';

    SELECT array_agg(id) INTO converted_status_ids FROM lead_status 
    WHERE nome ILIKE '%convertido%' OR nome ILIKE '%fechado%' OR nome ILIKE '%ganho%' OR nome ILIKE '%cliente%';

    WITH base AS (
        SELECT o.id, o.status_id, o.visto
        FROM orcamentos o
        WHERE 
            (_is_admin OR o.consultor_id = _consultor_id OR (_consultor_id IS NULL AND o.consultor = _consultor_nome))
            AND o.tenant_id = (SELECT tenant_id FROM consultores WHERE id = _consultor_id OR nome = _consultor_nome LIMIT 1)
    )
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'pendentes', COUNT(*) FILTER (WHERE status_id IS NULL OR NOT (status_id = ANY(terminal_status_ids))),
        'convertidos', COUNT(*) FILTER (WHERE status_id = ANY(converted_status_ids)),
        'nao_vistos', COUNT(*) FILTER (WHERE NOT visto),
        'documentacao_pendente', (
            SELECT COUNT(*) FROM base b 
            JOIN leads l ON b.id = l.id -- assumindo que orcamento.id mapeia para lead.id ou via lead_id
            -- Esta parte depende da lógica de doc pendente que varia, vamos simplificar para status 'Aguardando Documentação'
            WHERE b.status_id IN (SELECT id FROM lead_status WHERE nome ILIKE '%documentação%')
        )
    ) INTO result
    FROM base;

    RETURN result;
END;
$$;

-- 2. RPC para Conversão Atômica
CREATE OR REPLACE FUNCTION public.convert_lead_to_venda_v2(
    _lead_id UUID,
    _payload JSONB,
    _payment_composition JSONB,
    _idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cliente_id UUID;
    v_convertido_status_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_tenant_id UUID;
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

    -- 3. Validar Regras de Negócio (exemplo: valor > 0)
    IF (_payload->>'valor_projeto')::NUMERIC <= 0 THEN
        RAISE EXCEPTION 'O valor da venda deve ser maior que zero.';
    END IF;

    -- 4. Upsert Cliente
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
        ARRAY(SELECT jsonb_array_elements_text(_payload->'identidade_urls')),
        ARRAY(SELECT jsonb_array_elements_text(_payload->'comprovante_endereco_urls')),
        ARRAY(SELECT jsonb_array_elements_text(_payload->'comprovante_beneficiaria_urls')),
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
    ON CONFLICT (lead_id) DO UPDATE SET
        nome = EXCLUDED.nome,
        telefone = EXCLUDED.telefone,
        email = EXCLUDED.email,
        cpf_cnpj = EXCLUDED.cpf_cnpj,
        payment_composition = EXCLUDED.payment_composition,
        updated_at = v_now
    RETURNING id INTO v_cliente_id;

    -- 5. Atualizar Status do Lead e Orçamento
    SELECT id INTO v_convertido_status_id FROM lead_status WHERE nome = 'Aguardando Validação' LIMIT 1;
    
    IF v_convertido_status_id IS NOT NULL THEN
        UPDATE leads SET status_id = v_convertido_status_id, updated_at = v_now WHERE id = _lead_id;
        UPDATE orcamentos SET status_id = v_convertido_status_id, ultimo_contato = v_now, updated_at = v_now WHERE lead_id = _lead_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_cliente_id);
END;
$$;
