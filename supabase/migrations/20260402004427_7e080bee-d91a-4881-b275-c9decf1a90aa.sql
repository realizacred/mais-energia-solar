-- Replace trigger function to add DELETE handling
CREATE OR REPLACE FUNCTION public.trg_proposta_aceita_recebimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb;
  v_valor_total numeric := 0;
  v_opcao jsonb;
  v_cliente_id uuid;
  v_recebimento_id uuid;
  v_num_parcelas int := 1;
  v_forma text := 'À Vista';
  v_tipo text := 'a_vista';
  v_valor_parcela numeric := 0;
  v_entrada numeric := 0;
  v_venc date := CURRENT_DATE + 30;
  v_opcoes jsonb;
  v_elem jsonb;
  i int;
BEGIN
  -- ═══ DELETE: cancel pending/partial receivables ═══
  IF TG_OP = 'DELETE' THEN
    UPDATE recebimentos
       SET status = 'cancelado', updated_at = now()
     WHERE proposta_id = OLD.id
       AND status IN ('pendente', 'parcial');
    RETURN OLD;
  END IF;

  -- ═══ UPDATE: only fire when status transitions TO 'aceita' ═══
  IF NEW.status <> 'aceita' THEN RETURN NEW; END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'aceita' THEN RETURN NEW; END IF;

  -- Skip if recebimento already exists for this proposta
  IF EXISTS (SELECT 1 FROM recebimentos WHERE proposta_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- 1. Get latest version snapshot and valor_total
  SELECT pv.snapshot, COALESCE(pv.valor_total, 0)
    INTO v_snapshot, v_valor_total
  FROM proposta_versoes pv
  WHERE pv.proposta_id = NEW.id
  ORDER BY pv.created_at DESC
  LIMIT 1;

  IF v_valor_total <= 0 THEN RETURN NEW; END IF;

  -- 2. Resolve cliente_id from projeto
  IF NEW.projeto_id IS NOT NULL THEN
    SELECT p.cliente_id INTO v_cliente_id
    FROM projetos p
    WHERE p.id = NEW.projeto_id
    LIMIT 1;
  END IF;
  IF v_cliente_id IS NULL THEN
    v_cliente_id := NEW.cliente_id;
  END IF;

  -- 3. Extract chosen payment option from snapshot
  v_opcao := NULL;
  IF v_snapshot IS NOT NULL THEN
    v_opcoes := COALESCE(
      v_snapshot->'pagamentoOpcoes',
      v_snapshot->'pagamento_opcoes',
      '[]'::jsonb
    );

    IF jsonb_array_length(v_opcoes) > 0 THEN
      FOR v_elem IN SELECT value FROM jsonb_array_elements(v_opcoes)
      LOOP
        IF (v_elem->>'is_default')::boolean IS TRUE THEN
          v_opcao := v_elem;
          EXIT;
        END IF;
      END LOOP;
      IF v_opcao IS NULL THEN
        v_opcao := v_opcoes->0;
      END IF;
    END IF;
  END IF;

  -- 4. Parse payment option
  IF v_opcao IS NOT NULL THEN
    v_num_parcelas := COALESCE((v_opcao->>'parcelas')::int, 1);
    v_forma := COALESCE(v_opcao->>'label', v_opcao->>'tipo', 'À Vista');
    v_tipo := COALESCE(v_opcao->>'tipo', 'a_vista');
    v_entrada := COALESCE((v_opcao->>'entrada')::numeric, 0);
    v_valor_parcela := COALESCE((v_opcao->>'valor_parcela')::numeric, 0);
  END IF;

  IF v_num_parcelas < 1 THEN v_num_parcelas := 1; END IF;

  -- 5. Create recebimento
  INSERT INTO recebimentos (
    tenant_id, proposta_id, cliente_id, descricao,
    valor_total, total_pago, status,
    forma_pagamento_acordada, numero_parcelas,
    composicao_acordada, data_acordo
  )
  VALUES (
    NEW.tenant_id, NEW.id, v_cliente_id,
    COALESCE(NEW.titulo, 'Proposta aceita'),
    v_valor_total, 0, 'pendente',
    v_forma, v_num_parcelas,
    v_opcao, CURRENT_DATE
  )
  RETURNING id INTO v_recebimento_id;

  -- 6. Create parcelas
  IF v_recebimento_id IS NOT NULL AND v_num_parcelas > 0 THEN
    IF v_entrada > 0 THEN
      INSERT INTO parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
      VALUES (NEW.tenant_id, v_recebimento_id, 0, v_entrada, CURRENT_DATE, 'pendente');
    END IF;

    FOR i IN 1..v_num_parcelas LOOP
      INSERT INTO parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
      VALUES (
        NEW.tenant_id,
        v_recebimento_id,
        i,
        COALESCE(NULLIF(v_valor_parcela, 0), ROUND(v_valor_total / v_num_parcelas, 2)),
        v_venc + ((i - 1) * 30),
        'pendente'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger for UPDATE and DELETE
DROP TRIGGER IF EXISTS trg_proposta_aceita_recebimento ON public.propostas_nativas;
CREATE TRIGGER trg_proposta_aceita_recebimento
  AFTER UPDATE OR DELETE ON public.propostas_nativas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proposta_aceita_recebimento();