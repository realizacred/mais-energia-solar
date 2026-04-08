
CREATE OR REPLACE FUNCTION trg_proposta_aceita_comissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_percentual NUMERIC;
  v_valor_total NUMERIC;
  v_valor_comissao NUMERIC;
  v_consultor_id uuid;
  v_lead_id uuid;
BEGIN
  IF NEW.status = 'aceita' AND (OLD.status IS NULL OR OLD.status != 'aceita') THEN

    SELECT pv.valor_total INTO v_valor_total
    FROM proposta_versoes pv
    WHERE pv.proposta_id = NEW.id
    ORDER BY pv.versao_numero DESC
    LIMIT 1;

    IF v_valor_total IS NULL OR v_valor_total <= 0 THEN
      RETURN NEW;
    END IF;

    IF NEW.projeto_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM comissoes WHERE projeto_id = NEW.projeto_id
    ) THEN
      RETURN NEW;
    END IF;

    v_consultor_id := NEW.consultor_id;

    IF v_consultor_id IS NULL THEN
      SELECT lead_id INTO v_lead_id FROM propostas_nativas WHERE id = NEW.id;
      IF v_lead_id IS NOT NULL THEN
        SELECT consultor_id INTO v_consultor_id FROM leads WHERE id = v_lead_id;
      END IF;
    END IF;

    -- Fixed: use projetos.lead_id instead of deals.lead_id (deals has no lead_id column)
    IF v_consultor_id IS NULL AND NEW.projeto_id IS NOT NULL THEN
      SELECT l.consultor_id INTO v_consultor_id
      FROM projetos p
      LEFT JOIN leads l ON l.id = p.lead_id
      WHERE p.id = NEW.projeto_id
      LIMIT 1;
    END IF;

    IF v_consultor_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_plan
    FROM commission_plans
    WHERE tenant_id = NEW.tenant_id
      AND is_active = true
    LIMIT 1;

    IF v_plan.id IS NULL THEN
      RETURN NEW;
    END IF;

    v_percentual := COALESCE((v_plan.parameters->>'percentual')::numeric, 3.0);

    IF v_plan.parameters->'bonus' IS NOT NULL THEN
      DECLARE
        v_bonus RECORD;
      BEGIN
        FOR v_bonus IN
          SELECT * FROM jsonb_to_recordset(v_plan.parameters->'bonus')
          AS x(condicao text, valor numeric, bonus_percentual numeric)
          ORDER BY valor DESC
        LOOP
          IF v_bonus.condicao = 'valor_acima' AND v_valor_total > v_bonus.valor THEN
            v_percentual := v_percentual + v_bonus.bonus_percentual;
            EXIT;
          END IF;
        END LOOP;
      END;
    END IF;

    v_valor_comissao := ROUND(v_valor_total * v_percentual / 100, 2);

    INSERT INTO comissoes (
      tenant_id, consultor_id, projeto_id, cliente_id,
      valor_base, percentual_comissao, valor_comissao,
      mes_referencia, ano_referencia,
      status, descricao
    ) VALUES (
      NEW.tenant_id,
      v_consultor_id,
      NEW.projeto_id,
      NEW.cliente_id,
      v_valor_total,
      v_percentual,
      v_valor_comissao,
      EXTRACT(MONTH FROM NOW())::int,
      EXTRACT(YEAR FROM NOW())::int,
      'pendente',
      'Comissão automática — Proposta ' || COALESCE(NEW.codigo, NEW.id::text) || ' aceita'
    );
  END IF;

  RETURN NEW;
END;
$$;
