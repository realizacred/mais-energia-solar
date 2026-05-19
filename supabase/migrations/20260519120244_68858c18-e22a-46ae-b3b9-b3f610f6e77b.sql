-- 1. Update the enum to include 'viewed' and 'cancelled'
-- Note: value additions to enums cannot be executed in a transaction in some Postgres versions, 
-- but Supabase migrations handle this.
ALTER TYPE public.proposta_nativa_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.proposta_nativa_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Update the check constraint on propostas_nativas to include 'viewed' and 'cancelled'
ALTER TABLE public.propostas_nativas DROP CONSTRAINT IF EXISTS chk_status;
ALTER TABLE public.propostas_nativas ADD CONSTRAINT chk_status CHECK (
  status = ANY (ARRAY['draft', 'generated', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled', 'excluida', 'arquivada'])
);

-- 3. Fix create_proposta_nativa_atomic (Portuguese labels -> English labels)
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
  v_snapshot jsonb;
  v_funil_id uuid;
  v_etapa_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_consultor_id uuid;
BEGIN
  v_snapshot := public.normalize_proposta_snapshot(p_snapshot);

  SELECT p.tenant_id INTO v_tenant_id
  FROM profiles p WHERE p.user_id = auth.uid();

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado para o usuário atual';
  END IF;

  v_projeto_id := p_projeto_id;
  v_deal_id := p_deal_id;

  IF v_deal_id IS NOT NULL AND v_projeto_id IS NULL THEN
    SELECT projeto_id INTO v_projeto_id FROM deals WHERE id = v_deal_id;
  END IF;

  SELECT COALESCE(
    (SELECT c.id FROM consultores c
       JOIN deals d ON d.owner_id = c.user_id
      WHERE d.id = v_deal_id LIMIT 1),
    (SELECT l.consultor_id FROM leads l WHERE l.id = p_lead_id LIMIT 1),
    (SELECT proj.consultor_id FROM projetos proj WHERE proj.id = v_projeto_id LIMIT 1)
  ) INTO v_consultor_id;

  v_grupo := v_snapshot->>'grupo';
  IF v_grupo IS NOT NULL THEN
    v_grupo := CASE
      WHEN v_grupo LIKE 'A%' THEN 'A'
      WHEN v_grupo LIKE 'B%' THEN 'B'
      ELSE NULL
    END;
  END IF;

  v_geracao_mensal := (v_snapshot->>'geracaoMensalEstimada')::numeric;
  IF v_geracao_mensal IS NULL AND p_potencia_kwp > 0 THEN
    v_geracao_mensal := ROUND(p_potencia_kwp * COALESCE((v_snapshot->>'locIrradiacao')::numeric, 4.5) * 30 * 0.80);
  END IF;

  IF v_projeto_id IS NOT NULL THEN
    SELECT proj.cliente_id INTO v_cliente_id FROM projetos proj WHERE proj.id = v_projeto_id;
  END IF;
  IF v_cliente_id IS NULL AND v_deal_id IS NOT NULL THEN
    SELECT d.customer_id INTO v_cliente_id FROM deals d WHERE d.id = v_deal_id;
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

  IF v_projeto_id IS NULL THEN
    SELECT id INTO v_funil_id FROM projeto_funis
    WHERE tenant_id = v_tenant_id AND ativo = true AND lower(nome) = 'comercial'
    ORDER BY ordem ASC LIMIT 1;
    IF v_funil_id IS NULL THEN
      SELECT id INTO v_funil_id FROM projeto_funis
      WHERE tenant_id = v_tenant_id AND ativo = true ORDER BY ordem ASC LIMIT 1;
    END IF;
    IF v_funil_id IS NOT NULL THEN
      SELECT id INTO v_etapa_id FROM projeto_etapas
      WHERE funil_id = v_funil_id ORDER BY ordem ASC LIMIT 1;
    END IF;

    INSERT INTO projetos (
      tenant_id, lead_id, cliente_id, consultor_id, status, is_principal,
      funil_id, etapa_id, valor_total
    )
    VALUES (
      v_tenant_id, p_lead_id, v_cliente_id, v_consultor_id, 'criado',
      NOT EXISTS (SELECT 1 FROM projetos WHERE cliente_id = v_cliente_id AND is_principal = true),
      v_funil_id, v_etapa_id, COALESCE(p_valor_total, 0)
    )
    RETURNING id INTO v_projeto_id;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    SELECT d.id INTO v_deal_id FROM deals d WHERE d.projeto_id = v_projeto_id LIMIT 1;
  END IF;

  IF v_deal_id IS NULL AND v_projeto_id IS NOT NULL THEN
    PERFORM public.ensure_tenant_default_pipeline(v_tenant_id);
    SELECT id INTO v_pipeline_id FROM pipelines
    WHERE tenant_id = v_tenant_id AND is_default = true AND is_active = true
    ORDER BY created_at ASC LIMIT 1;
    IF v_pipeline_id IS NULL THEN
      SELECT id INTO v_pipeline_id FROM pipelines
      WHERE tenant_id = v_tenant_id AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM pipeline_stages
      WHERE pipeline_id = v_pipeline_id AND is_closed = false
      ORDER BY position ASC LIMIT 1;
      IF v_stage_id IS NOT NULL AND v_consultor_id IS NOT NULL THEN
        INSERT INTO deals (
          tenant_id, title, customer_id, owner_id, pipeline_id, stage_id,
          projeto_id, value, status
        )
        VALUES (
          v_tenant_id, COALESCE(NULLIF(btrim(p_titulo), ''), 'Proposta'),
          v_cliente_id,
          (SELECT user_id FROM consultores WHERE id = v_consultor_id LIMIT 1),
          v_pipeline_id, v_stage_id,
          v_projeto_id, COALESCE(p_valor_total, 0), 'open'
        )
        RETURNING id INTO v_deal_id;
        UPDATE projetos SET deal_id = v_deal_id WHERE id = v_projeto_id;
      END IF;
    END IF;
  END IF;

  -- Fix: status 'rascunho' -> 'draft'
  INSERT INTO propostas_nativas (
    tenant_id, titulo, lead_id, cliente_id, projeto_id, deal_id, origem, status,
    consultor_id, created_by
  ) VALUES (
    v_tenant_id, p_titulo, p_lead_id, v_cliente_id, v_projeto_id, v_deal_id, p_origem, 'draft',
    v_consultor_id, auth.uid()
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO proposta_versoes (
    tenant_id, proposta_id, versao_numero, status,
    potencia_kwp, valor_total, grupo, geracao_mensal, economia_mensal, snapshot,
    is_official
  ) VALUES (
    v_tenant_id, v_proposta_id, 1, 'draft'::public.proposta_nativa_status,
    p_potencia_kwp, p_valor_total, v_grupo, v_geracao_mensal, NULL, v_snapshot,
    FALSE
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

-- 4. Fix proposal_create_version (Portuguese labels -> English labels)
CREATE OR REPLACE FUNCTION public.proposal_create_version(
  p_proposta_id uuid,
  p_versao_id uuid DEFAULT NULL::uuid,
  p_snapshot jsonb DEFAULT NULL::jsonb,
  p_potencia_kwp numeric DEFAULT NULL::numeric,
  p_valor_total numeric DEFAULT NULL::numeric,
  p_economia_mensal numeric DEFAULT NULL::numeric,
  p_geracao_mensal numeric DEFAULT NULL::numeric,
  p_grupo text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_calc_hash text DEFAULT NULL::text,
  p_engine_version text DEFAULT NULL::text,
  p_validade_dias integer DEFAULT 30,
  p_observacoes text DEFAULT NULL::text,
  p_gerado_por uuid DEFAULT NULL::uuid,
  p_payback_meses integer DEFAULT NULL::integer,
  p_intent text DEFAULT 'draft'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_versao_id uuid;
  v_is_official   boolean;
  v_tenant_id     uuid;
  v_status        public.proposta_nativa_status;
  v_now           timestamptz := now();
  v_result        jsonb;
BEGIN
  v_is_official := p_intent IN ('active', 'published', 'generated', 'sent');

  SELECT tenant_id INTO v_tenant_id
  FROM public.propostas_nativas
  WHERE id = p_proposta_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Proposta % não encontrada (tenant nulo)', p_proposta_id;
  END IF;

  UPDATE public.propostas_nativas
  SET draft_total = p_valor_total,
      has_unpublished_changes = NOT v_is_official,
      updated_at = v_now
  WHERE id = p_proposta_id;

  IF v_is_official THEN
    UPDATE public.proposta_versoes
    SET is_official = FALSE,
        substituida_em = COALESCE(substituida_em, v_now)
    WHERE proposta_id = p_proposta_id
      AND is_official = TRUE;
  END IF;

  v_status := CASE
    WHEN v_is_official THEN 'generated'::public.proposta_nativa_status
    WHEN p_intent = 'sent' THEN 'sent'::public.proposta_nativa_status
    ELSE 'draft'::public.proposta_nativa_status
  END;

  INSERT INTO public.proposta_versoes (
    tenant_id, proposta_id, versao_numero, snapshot,
    potencia_kwp, valor_total, economia_mensal, geracao_mensal, grupo,
    idempotency_key, calc_hash, engine_version,
    validade_dias, valido_ate, observacoes,
    gerado_por, gerado_em, generated_at,
    payback_meses, status, is_official
  )
  SELECT
    v_tenant_id, p_proposta_id,
    COALESCE((SELECT MAX(versao_numero) FROM public.proposta_versoes WHERE proposta_id = p_proposta_id), 0) + 1,
    p_snapshot,
    p_potencia_kwp, p_valor_total, p_economia_mensal, p_geracao_mensal, p_grupo,
    p_idempotency_key, p_calc_hash, p_engine_version,
    p_validade_dias,
    CASE WHEN v_is_official THEN (v_now + (p_validade_dias || ' days')::interval) ELSE NULL END,
    p_observacoes,
    p_gerado_por,
    CASE WHEN v_is_official THEN v_now ELSE NULL END,
    CASE WHEN v_is_official THEN v_now ELSE NULL END,
    p_payback_meses,
    v_status,
    v_is_official
  RETURNING id INTO v_new_versao_id;

  -- Fix: 'gerada' -> 'generated', 'enviada' -> 'sent'
  IF v_is_official THEN
    UPDATE public.propostas_nativas
    SET status = 'generated',
        versao_atual = (SELECT versao_numero FROM public.proposta_versoes WHERE id = v_new_versao_id),
        updated_at = v_now
    WHERE id = p_proposta_id;
  ELSIF p_intent = 'sent' THEN
    UPDATE public.propostas_nativas
    SET status = 'sent',
        updated_at = v_now
    WHERE id = p_proposta_id;
  END IF;

  v_result := jsonb_build_object(
    'versao_id', v_new_versao_id,
    'proposta_id', p_proposta_id,
    'intent', p_intent,
    'is_official', v_is_official,
    'new_version_created', true
  );
  RETURN v_result;
END;
$function$;

-- 5. Fix sync_deal_status_on_proposal_acceptance (detect accepted)
CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
    v_current_status text;
BEGIN
    -- SÓ age se for a PROPOSTA PRINCIPAL
    IF NOT COALESCE(NEW.is_principal, false) THEN
        RETURN NEW;
    END IF;

    -- Fix: include 'accepted'
    IF (LOWER(NEW.status) IN ('accepted', 'aceita', 'aceito', 'aprovada', 'ganha')) AND 
       (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            IF v_current_status IS DISTINCT FROM 'won' THEN
                UPDATE public.deals SET status = 'won' WHERE id = v_deal_id;

                SELECT pipeline_id INTO v_pipeline_id FROM public.deals WHERE id = v_deal_id;
                
                IF v_pipeline_id IS NOT NULL THEN
                    SELECT id INTO v_won_stage_id 
                    FROM public.pipeline_stages 
                    WHERE pipeline_id = v_pipeline_id AND is_won = true 
                    LIMIT 1;

                    IF v_won_stage_id IS NOT NULL THEN
                        UPDATE public.deals 
                        SET stage_id = v_won_stage_id 
                        WHERE id = v_deal_id AND pipeline_id = v_pipeline_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 6. Fix trg_proposta_aceita_comissao (detect accepted)
CREATE OR REPLACE FUNCTION public.trg_proposta_aceita_comissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Fix: include 'accepted'
  IF lower(coalesce(NEW.status::text,'')) NOT IN ('accepted','aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.status::text,'')) = lower(coalesce(NEW.status::text,'')) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.process_proposta_aceita(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'process_proposta_aceita falhou (comissao) p=%: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 7. Fix trg_proposta_aceita_recebimento (detect accepted)
CREATE OR REPLACE FUNCTION public.trg_proposta_aceita_recebimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.recebimentos
       SET status = 'cancelado', updated_at = now()
     WHERE proposta_id = OLD.id
       AND status IN ('pendente', 'parcial');
    RETURN OLD;
  END IF;

  -- Fix: include 'accepted'
  IF lower(coalesce(NEW.status::text,'')) NOT IN ('accepted','aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND lower(coalesce(OLD.status::text,'')) = lower(coalesce(NEW.status::text,'')) THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.process_proposta_aceita(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'process_proposta_aceita falhou (recebimento) p=%: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- 8. Fix process_proposta_aceita (detect accepted)
CREATE OR REPLACE FUNCTION public.process_proposta_aceita(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta       public.propostas_nativas%ROWTYPE;
  v_versao         public.proposta_versoes%ROWTYPE;
  v_venda_id       uuid;
  v_obra_id        uuid;
  v_comissao_id    uuid;
  v_recebimento_id uuid;
  v_plan           RECORD;
  v_percentual     NUMERIC;
  v_valor_comissao NUMERIC;
  v_consultor_id   uuid;
  v_lead_id        uuid;
  v_bonus          RECORD;
  v_snapshot       jsonb;
  v_valor_total    numeric := 0;
  v_opcao          jsonb;
  v_cliente_id     uuid;
  v_num_parcelas   int := 1;
  v_forma          text := 'À Vista';
  v_valor_parcela  numeric := 0;
  v_entrada        numeric := 0;
  v_venc           date := CURRENT_DATE + 30;
  v_opcoes         jsonb;
  v_elem           jsonb;
  i                int;
  v_skipped        text[] := ARRAY[]::text[];
BEGIN
  IF p_proposta_id IS NULL THEN RETURN jsonb_build_object('error','null_id'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('proposta_aceita:' || p_proposta_id::text));

  SELECT * INTO v_proposta FROM public.propostas_nativas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','proposta_not_found'); END IF;

  -- Fix: include 'accepted'
  IF lower(coalesce(v_proposta.status::text,'')) NOT IN ('accepted','aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN jsonb_build_object('skipped','status_not_aceita','status', v_proposta.status);
  END IF;

  SELECT * INTO v_versao FROM public.proposta_versoes
  WHERE proposta_id = p_proposta_id
  ORDER BY (versao_numero = v_proposta.versao_atual) DESC, versao_numero DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped','no_version'); END IF;

  v_valor_total := COALESCE(v_versao.valor_total, 0);
  IF v_valor_total <= 0 THEN RETURN jsonb_build_object('skipped','valor_zero'); END IF;

  BEGIN
    v_venda_id := public.create_venda_from_proposta(v_versao.id);
  EXCEPTION WHEN OTHERS THEN
    v_skipped := array_append(v_skipped, 'venda_error:' || SQLERRM);
  END;

  IF v_venda_id IS NOT NULL THEN
    BEGIN
      v_obra_id := public.create_obra_from_venda(v_venda_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.wave2_financial_fix_log(context, detail)
      VALUES('create_obra_from_venda', 'venda_id=' || v_venda_id::text || ' err=' || SQLERRM);
      v_skipped := array_append(v_skipped, 'obra_error:' || SQLERRM);
    END;
  END IF;

  IF v_proposta.projeto_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.comissoes WHERE projeto_id = v_proposta.projeto_id) THEN
    v_skipped := array_append(v_skipped, 'comissao_existente');
  ELSE
    v_consultor_id := v_proposta.consultor_id;
    IF v_consultor_id IS NULL THEN
      SELECT lead_id INTO v_lead_id FROM public.propostas_nativas WHERE id = v_proposta.id;
      IF v_lead_id IS NOT NULL THEN
        SELECT consultor_id INTO v_consultor_id FROM public.leads WHERE id = v_lead_id;
      END IF;
    END IF;
    IF v_consultor_id IS NULL AND v_proposta.projeto_id IS NOT NULL THEN
      SELECT l.consultor_id INTO v_consultor_id
      FROM public.projetos p LEFT JOIN public.leads l ON l.id = p.lead_id
      WHERE p.id = v_proposta.projeto_id LIMIT 1;
    END IF;
    IF v_consultor_id IS NULL THEN
      v_skipped := array_append(v_skipped, 'comissao_sem_consultor');
    ELSE
      SELECT * INTO v_plan FROM public.commission_plans
      WHERE tenant_id = v_proposta.tenant_id AND is_active = true LIMIT 1;
      IF v_plan.id IS NULL THEN
        v_skipped := array_append(v_skipped, 'comissao_sem_plano');
      ELSE
        v_percentual := COALESCE((v_plan.parameters->>'percentual')::numeric, 3.0);
        IF v_plan.parameters->'bonus' IS NOT NULL THEN
          FOR v_bonus IN
            SELECT * FROM jsonb_to_recordset(v_plan.parameters->'bonus')
            AS x(condicao text, valor numeric, bonus_percentual numeric)
            ORDER BY valor DESC
          LOOP
            IF v_bonus.condicao = 'valor_acima' AND v_valor_total > v_bonus.valor THEN
              v_percentual := v_percentual + v_bonus.bonus_percentual; EXIT;
            END IF;
          END LOOP;
        END IF;

        v_valor_comissao := (v_valor_total * v_percentual) / 100;
        v_cliente_id := v_proposta.cliente_id;

        INSERT INTO public.comissoes (
          tenant_id, consultor_id, cliente_id, projeto_id,
          descricao, valor_base, percentual_comissao, valor_comissao,
          mes_referencia, ano_referencia, status
        ) VALUES (
          v_proposta.tenant_id, v_consultor_id, v_cliente_id, v_proposta.projeto_id,
          'Comissão autom. Proposta ' || v_proposta.codigo,
          v_valor_total, v_percentual, v_valor_comissao,
          EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE), 'pendente'
        ) RETURNING id INTO v_comissao_id;
      END IF;
    END IF;
  END IF;

  BEGIN
    IF v_snapshot->'pagamentoOpcoes' IS NOT NULL AND jsonb_array_length(v_snapshot->'pagamentoOpcoes') > 0 THEN
      v_elem := (v_snapshot->'pagamentoOpcoes')->0;
      v_num_parcelas := COALESCE((v_elem->>'num_parcelas')::int, 1);
      v_forma := COALESCE(v_elem->>'forma_pagamento', 'À Vista');
      v_valor_parcela := COALESCE((v_elem->>'valor_parcela')::numeric, v_valor_total);
      v_entrada := COALESCE((v_elem->>'entrada')::numeric, 0);
    END IF;

    INSERT INTO public.recebimentos (
      tenant_id, cliente_id, projeto_id, proposta_id,
      descricao, valor_total, valor_recebido, status,
      data_vencimento, num_parcelas, forma_pagamento
    ) VALUES (
      v_proposta.tenant_id, v_proposta.cliente_id, v_proposta.projeto_id, v_proposta.id,
      'Recebimento Proposta ' || v_proposta.codigo,
      v_valor_total, 0, 'pendente',
      v_venc, v_num_parcelas, v_forma
    ) RETURNING id INTO v_recebimento_id;

    IF v_recebimento_id IS NOT NULL THEN
      FOR i IN 1..v_num_parcelas LOOP
        INSERT INTO public.parcelas (
          tenant_id, recebimento_id, numero_parcela, valor,
          data_vencimento, status
        ) VALUES (
          v_proposta.tenant_id, v_recebimento_id, i,
          CASE WHEN i=1 THEN (v_valor_total / v_num_parcelas) + v_entrada ELSE (v_valor_total / v_num_parcelas) END,
          v_venc + ((i-1) || ' months')::interval,
          'pendente'
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_skipped := array_append(v_skipped, 'recebimento_error:' || SQLERRM);
  END;

  RETURN jsonb_build_object(
    'success', true,
    'venda_id', v_venda_id,
    'obra_id', v_obra_id,
    'comissao_id', v_comissao_id,
    'recebimento_id', v_recebimento_id,
    'skipped', v_skipped
  );
END;
$function$;
