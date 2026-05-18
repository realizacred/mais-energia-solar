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
    v_convertido_status_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_tenant_id UUID;
    v_cpf_cnpj TEXT;
    v_email TEXT;
    v_telefone TEXT;
    v_telefone_normalized TEXT;
    v_nome TEXT;
    v_valor_projeto NUMERIC;
BEGIN
    -- 1. Resolver tenant com fallback seguro pelo lead
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

    -- 3. Idempotência e deduplicação forte: lead, idempotency key, CPF/CNPJ, e-mail, telefone normalizado
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

    -- 4. Fallback cirúrgico para cliente SolarMarket incompleto: Marco e outros importados sem contato
    IF v_cliente_id IS NULL AND v_nome IS NOT NULL THEN
      SELECT c.id INTO v_cliente_id
      FROM clientes c
      WHERE c.tenant_id = v_tenant_id
        AND c.external_source = 'solarmarket'
        AND NULLIF(c.telefone_normalized, '') IS NULL
        AND NULLIF(c.email, '') IS NULL
        AND NULLIF(c.cpf_cnpj, '') IS NULL
        AND length(BTRIM(c.nome)) >= 8
        AND (
          LOWER(v_nome) LIKE LOWER(BTRIM(c.nome)) || '%'
          OR LOWER(BTRIM(c.nome)) LIKE LOWER(v_nome) || '%'
        )
      ORDER BY length(BTRIM(c.nome)) DESC, c.created_at DESC
      LIMIT 1;
    END IF;

    -- 5. Validar valor quando informado
    IF v_valor_projeto IS NOT NULL AND v_valor_projeto <= 0 THEN
        RAISE EXCEPTION 'O valor da venda deve ser maior que zero.';
    END IF;

    -- 6. Atualizar cliente existente ou criar novo
    IF v_cliente_id IS NOT NULL THEN
        UPDATE clientes SET
            lead_id = COALESCE(lead_id, _lead_id),
            nome = COALESCE(v_nome, nome),
            telefone = COALESCE(v_telefone, telefone),
            email = COALESCE(v_email, email),
            cpf_cnpj = COALESCE(v_cpf_cnpj, cpf_cnpj),
            data_nascimento = COALESCE(NULLIF(_payload->>'data_nascimento', '')::date, data_nascimento),
            cep = COALESCE(NULLIF(_payload->>'cep', ''), cep),
            estado = COALESCE(NULLIF(_payload->>'estado', ''), estado),
            cidade = COALESCE(NULLIF(_payload->>'cidade', ''), cidade),
            bairro = COALESCE(NULLIF(_payload->>'bairro', ''), bairro),
            rua = COALESCE(NULLIF(_payload->>'rua', ''), rua),
            numero = COALESCE(NULLIF(_payload->>'numero', ''), numero),
            complemento = COALESCE(NULLIF(_payload->>'complemento', ''), complemento),
            disjuntor_id = COALESCE(NULLIF(_payload->>'disjuntor_id', '')::uuid, disjuntor_id),
            transformador_id = COALESCE(NULLIF(_payload->>'transformador_id', '')::uuid, transformador_id),
            localizacao = COALESCE(NULLIF(_payload->>'localizacao', ''), localizacao),
            observacoes = COALESCE(NULLIF(_payload->>'observacoes', ''), observacoes),
            identidade_urls = CASE WHEN jsonb_typeof(COALESCE(_payload->'identidade_urls', '[]'::jsonb)) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'identidade_urls', '[]'::jsonb))) ELSE identidade_urls END,
            comprovante_endereco_urls = CASE WHEN jsonb_typeof(COALESCE(_payload->'comprovante_endereco_urls', '[]'::jsonb)) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_endereco_urls', '[]'::jsonb))) ELSE comprovante_endereco_urls END,
            comprovante_beneficiaria_urls = CASE WHEN jsonb_typeof(COALESCE(_payload->'comprovante_beneficiaria_urls', '[]'::jsonb)) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_beneficiaria_urls', '[]'::jsonb))) ELSE comprovante_beneficiaria_urls END,
            simulacao_aceita_id = COALESCE(NULLIF(_payload->>'simulacao_aceita_id', '')::uuid, simulacao_aceita_id),
            assinatura_url = COALESCE(NULLIF(_payload->>'assinatura_url', ''), assinatura_url),
            potencia_kwp = COALESCE(NULLIF(_payload->>'potencia_kwp', '')::numeric, potencia_kwp),
            valor_projeto = COALESCE(v_valor_projeto, valor_projeto),
            payment_composition = _payment_composition,
            updated_at = v_now
        WHERE id = v_cliente_id;
    ELSE
        BEGIN
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
              v_nome,
              v_telefone,
              v_email,
              v_cpf_cnpj,
              NULLIF(_payload->>'data_nascimento', '')::date,
              NULLIF(_payload->>'cep', ''),
              NULLIF(_payload->>'estado', ''),
              NULLIF(_payload->>'cidade', ''),
              NULLIF(_payload->>'bairro', ''),
              NULLIF(_payload->>'rua', ''),
              NULLIF(_payload->>'numero', ''),
              NULLIF(_payload->>'complemento', ''),
              NULLIF(_payload->>'disjuntor_id', '')::uuid,
              NULLIF(_payload->>'transformador_id', '')::uuid,
              NULLIF(_payload->>'localizacao', ''),
              NULLIF(_payload->>'observacoes', ''),
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'identidade_urls', '[]'::jsonb))),
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_endereco_urls', '[]'::jsonb))),
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'comprovante_beneficiaria_urls', '[]'::jsonb))),
              NULLIF(_payload->>'simulacao_aceita_id', '')::uuid,
              NULLIF(_payload->>'assinatura_url', ''),
              NULLIF(_payload->>'potencia_kwp', '')::numeric,
              v_valor_projeto,
              _payment_composition,
              v_tenant_id,
              _idempotency_key,
              v_now,
              v_now
          )
          RETURNING id INTO v_cliente_id;
        EXCEPTION WHEN unique_violation THEN
          IF SQLERRM LIKE '%uq_clientes_tenant_cliente_code%' THEN
            SELECT c.id INTO v_cliente_id
            FROM clientes c
            WHERE c.tenant_id = v_tenant_id
              AND (
                (v_cpf_cnpj IS NOT NULL AND regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g') = v_cpf_cnpj)
                OR (v_email IS NOT NULL AND LOWER(BTRIM(COALESCE(c.email, ''))) = v_email)
                OR (v_telefone_normalized IS NOT NULL AND c.telefone_normalized = v_telefone_normalized)
                OR (v_nome IS NOT NULL AND LOWER(BTRIM(c.nome)) = LOWER(v_nome))
              )
            ORDER BY c.updated_at DESC
            LIMIT 1;

            IF v_cliente_id IS NULL THEN
              RAISE EXCEPTION 'Já existe um cliente com este código. Atualize a lista e tente novamente.';
            END IF;
          ELSE
            RAISE;
          END IF;
        END;
    END IF;

    -- 7. Atualizar Status do Lead e Orçamento
    SELECT id INTO v_convertido_status_id FROM lead_status WHERE nome = 'Aguardando Validação' LIMIT 1;
    
    IF v_convertido_status_id IS NOT NULL THEN
        UPDATE leads SET status_id = v_convertido_status_id, updated_at = v_now WHERE id = _lead_id AND tenant_id = v_tenant_id;
        UPDATE orcamentos SET status_id = v_convertido_status_id, ultimo_contato = v_now, updated_at = v_now WHERE lead_id = _lead_id AND tenant_id = v_tenant_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'id', v_cliente_id, 'reused_cliente', true);
END;
$function$;