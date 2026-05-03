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

  IF lower(coalesce(v_proposta.status::text,'')) NOT IN ('aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN jsonb_build_object('skipped','status_not_aceita','status', v_proposta.status);
  END IF;

  -- Versão "principal": a com versao_numero == propostas_nativas.versao_atual, fallback para a mais recente
  SELECT * INTO v_versao
  FROM public.proposta_versoes
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
        v_valor_comissao := ROUND(v_valor_total * v_percentual / 100, 2);
        INSERT INTO public.comissoes (
          tenant_id, consultor_id, projeto_id, cliente_id,
          valor_base, percentual_comissao, valor_comissao,
          mes_referencia, ano_referencia, status, descricao
        ) VALUES (
          v_proposta.tenant_id, v_consultor_id, v_proposta.projeto_id, v_proposta.cliente_id,
          v_valor_total, v_percentual, v_valor_comissao,
          EXTRACT(MONTH FROM NOW())::int, EXTRACT(YEAR FROM NOW())::int,
          'pendente',
          'Comissão automática — Proposta ' || COALESCE(v_proposta.codigo, v_proposta.id::text) || ' aceita'
        ) RETURNING id INTO v_comissao_id;
      END IF;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.recebimentos WHERE proposta_id = v_proposta.id) THEN
    v_skipped := array_append(v_skipped, 'recebimento_existente');
  ELSE
    v_snapshot := v_versao.snapshot;
    v_cliente_id := NULL;
    IF v_proposta.projeto_id IS NOT NULL THEN
      SELECT p.cliente_id INTO v_cliente_id FROM public.projetos p WHERE p.id = v_proposta.projeto_id LIMIT 1;
    END IF;
    IF v_cliente_id IS NULL THEN v_cliente_id := v_proposta.cliente_id; END IF;

    v_opcao := NULL;
    IF v_snapshot IS NOT NULL THEN
      v_opcoes := COALESCE(v_snapshot->'pagamentoOpcoes', v_snapshot->'pagamento_opcoes', '[]'::jsonb);
      IF jsonb_array_length(v_opcoes) > 0 THEN
        FOR v_elem IN SELECT value FROM jsonb_array_elements(v_opcoes) LOOP
          IF (v_elem->>'is_default')::boolean IS TRUE THEN v_opcao := v_elem; EXIT; END IF;
        END LOOP;
        IF v_opcao IS NULL THEN v_opcao := v_opcoes->0; END IF;
      END IF;
    END IF;

    IF v_opcao IS NOT NULL THEN
      v_num_parcelas  := COALESCE((v_opcao->>'parcelas')::int, 1);
      v_forma         := COALESCE(v_opcao->>'label', v_opcao->>'tipo', 'À Vista');
      v_entrada       := COALESCE((v_opcao->>'entrada')::numeric, 0);
      v_valor_parcela := COALESCE((v_opcao->>'valor_parcela')::numeric, 0);
    END IF;
    IF v_num_parcelas < 1 THEN v_num_parcelas := 1; END IF;

    INSERT INTO public.recebimentos (
      tenant_id, proposta_id, cliente_id, descricao,
      valor_total, total_pago, status,
      forma_pagamento_acordada, numero_parcelas,
      composicao_acordada, data_acordo
    ) VALUES (
      v_proposta.tenant_id, v_proposta.id, v_cliente_id,
      COALESCE(v_proposta.titulo, 'Proposta aceita'),
      v_valor_total, 0, 'pendente',
      v_forma, v_num_parcelas, v_opcao, CURRENT_DATE
    ) RETURNING id INTO v_recebimento_id;

    IF v_recebimento_id IS NOT NULL AND v_num_parcelas > 0 THEN
      IF v_entrada > 0 THEN
        INSERT INTO public.parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
        VALUES (v_proposta.tenant_id, v_recebimento_id, 0, v_entrada, CURRENT_DATE, 'pendente');
      END IF;
      FOR i IN 1..v_num_parcelas LOOP
        INSERT INTO public.parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
        VALUES (
          v_proposta.tenant_id, v_recebimento_id, i,
          COALESCE(NULLIF(v_valor_parcela, 0), ROUND(v_valor_total / v_num_parcelas, 2)),
          v_venc + ((i - 1) * 30), 'pendente'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'proposta_id', v_proposta.id,
    'versao_id',   v_versao.id,
    'venda_id',    v_venda_id,
    'comissao_id', v_comissao_id,
    'recebimento_id', v_recebimento_id,
    'skipped',     to_jsonb(v_skipped)
  );
END;
$function$;