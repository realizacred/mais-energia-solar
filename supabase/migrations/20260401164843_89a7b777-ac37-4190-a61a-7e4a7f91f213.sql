-- 1. Add proposta_id to recebimentos
ALTER TABLE public.recebimentos 
  ADD COLUMN IF NOT EXISTS proposta_id uuid REFERENCES public.propostas_nativas(id) ON DELETE SET NULL;

-- 2. Make cliente_id nullable (needed for future avulsos)
ALTER TABLE public.recebimentos 
  ALTER COLUMN cliente_id DROP NOT NULL;

-- 3. Index for dedup check
CREATE INDEX IF NOT EXISTS idx_recebimentos_proposta_id ON public.recebimentos(proposta_id) WHERE proposta_id IS NOT NULL;

-- 4. Rewrite the trigger function to use real payment options from snapshot
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
  -- Only fire when status changes to 'aceita'
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
  -- Fallback to proposta.cliente_id
  IF v_cliente_id IS NULL THEN
    v_cliente_id := NEW.cliente_id;
  END IF;

  -- 3. Extract chosen payment option from snapshot
  -- Try pagamentoOpcoes first (camelCase), then pagamento_opcoes (snake_case)
  v_opcao := NULL;
  IF v_snapshot IS NOT NULL THEN
    v_opcoes := COALESCE(
      v_snapshot->'pagamentoOpcoes',
      v_snapshot->'pagamento_opcoes',
      '[]'::jsonb
    );

    -- Find is_default=true option first
    IF jsonb_array_length(v_opcoes) > 0 THEN
      FOR v_elem IN SELECT value FROM jsonb_array_elements(v_opcoes)
      LOOP
        IF (v_elem->>'is_default')::boolean IS TRUE THEN
          v_opcao := v_elem;
          EXIT;
        END IF;
      END LOOP;
      -- Fallback: first option
      IF v_opcao IS NULL THEN
        v_opcao := v_opcoes->0;
      END IF;
    END IF;
  END IF;

  -- 4. Parse payment option fields
  IF v_opcao IS NOT NULL THEN
    v_forma := COALESCE(v_opcao->>'nome', v_forma);
    v_tipo := COALESCE(v_opcao->>'tipo', v_tipo);
    v_num_parcelas := GREATEST(COALESCE((v_opcao->>'num_parcelas')::int, 1), 1);
    v_valor_parcela := COALESCE((v_opcao->>'valor_parcela')::numeric, 0);
    v_entrada := COALESCE((v_opcao->>'entrada')::numeric, 0);
  ELSE
    -- No payment option found — fallback: 1 parcela, valor total
    v_num_parcelas := 1;
    v_valor_parcela := v_valor_total;
  END IF;

  -- 5. Create recebimento
  INSERT INTO recebimentos (
    tenant_id, cliente_id, projeto_id, proposta_id,
    valor_total, numero_parcelas,
    forma_pagamento_acordada,
    data_acordo, status, descricao
  ) VALUES (
    NEW.tenant_id,
    v_cliente_id,
    NEW.projeto_id,
    NEW.id,
    v_valor_total,
    v_num_parcelas,
    v_forma,
    NOW(),
    'pendente',
    'Recebimento automático — Proposta ' || COALESCE(NEW.codigo, NEW.id::text)
  ) RETURNING id INTO v_recebimento_id;

  -- 6. Create parcelas based on type
  IF v_tipo = 'a_vista' OR v_num_parcelas = 1 THEN
    -- Single payment
    INSERT INTO parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
    VALUES (NEW.tenant_id, v_recebimento_id, 1, v_valor_total, v_venc, 'pendente');

  ELSIF v_entrada > 0 THEN
    -- First parcela = entrada
    INSERT INTO parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
    VALUES (NEW.tenant_id, v_recebimento_id, 1, v_entrada, v_venc, 'pendente');

    -- Remaining parcelas
    FOR i IN 2..v_num_parcelas LOOP
      INSERT INTO parcelas (tenant_id, recebimento_id, numero_parcela, valor, data_vencimento, status)
      VALUES (
        NEW.tenant_id,
        v_recebimento_id,
        i,
        COALESCE(NULLIF(v_valor_parcela, 0), ROUND((v_valor_total - v_entrada) / GREATEST(v_num_parcelas - 1, 1), 2)),
        v_venc + ((i - 1) * 30),
        'pendente'
      );
    END LOOP;

  ELSE
    -- Equal parcelas, no entrada
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

-- 5. Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_proposta_aceita_recebimento ON public.propostas_nativas;
CREATE TRIGGER trg_proposta_aceita_recebimento
  AFTER UPDATE ON public.propostas_nativas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_proposta_aceita_recebimento();