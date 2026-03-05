-- =============================================
-- ESTOQUE V2 - Fix gaps from audit
-- =============================================

-- 1. Add missing columns to estoque_movimentos
ALTER TABLE public.estoque_movimentos 
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Idempotency: unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_mov_idempotency 
  ON public.estoque_movimentos(tenant_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Composite index for saldo per location
CREATE INDEX IF NOT EXISTS idx_estoque_mov_item_local 
  ON public.estoque_movimentos(tenant_id, item_id, local_id);

-- 2. Add missing columns to estoque_reservas
ALTER TABLE public.estoque_reservas 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS observacao text;

CREATE INDEX IF NOT EXISTS idx_estoque_reservas_tenant 
  ON public.estoque_reservas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estoque_reservas_status 
  ON public.estoque_reservas(tenant_id, status) WHERE status = 'active';

-- 3. Add description/fornecedor to estoque_itens for richer catalog
ALTER TABLE public.estoque_itens 
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS fornecedor text,
  ADD COLUMN IF NOT EXISTS codigo_barras text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_itens_barcode 
  ON public.estoque_itens(tenant_id, codigo_barras) 
  WHERE codigo_barras IS NOT NULL;

-- 4. Fix estoque_saldos view: include items with ZERO movements (LEFT JOIN from itens)
DROP VIEW IF EXISTS public.estoque_saldos;

CREATE OR REPLACE VIEW public.estoque_saldos WITH (security_invoker = true) AS
SELECT
  i.tenant_id,
  i.id AS item_id,
  i.nome,
  i.sku,
  i.categoria,
  i.unidade,
  i.custo_medio,
  i.estoque_minimo,
  i.ativo,
  i.codigo_barras,
  COALESCE(
    (SELECT SUM(
      CASE 
        WHEN m.tipo = 'entrada' THEN m.quantidade
        WHEN m.tipo = 'saida' THEN -m.quantidade
        WHEN m.tipo = 'ajuste' THEN m.quantidade
        WHEN m.tipo = 'transferencia' THEN 0
        ELSE 0
      END
    ) FROM public.estoque_movimentos m WHERE m.item_id = i.id), 0
  ) AS estoque_atual,
  COALESCE(
    (SELECT SUM(r.quantidade_reservada) 
     FROM public.estoque_reservas r 
     WHERE r.item_id = i.id AND r.status = 'active'), 0
  ) AS reservado
FROM public.estoque_itens i;

-- 5. New view: saldo per location
CREATE OR REPLACE VIEW public.estoque_saldos_local WITH (security_invoker = true) AS
SELECT
  m.tenant_id,
  m.item_id,
  m.local_id,
  i.nome AS item_nome,
  i.sku,
  i.unidade,
  l.nome AS local_nome,
  COALESCE(SUM(
    CASE 
      WHEN m.tipo = 'entrada' THEN m.quantidade
      WHEN m.tipo = 'saida' THEN -m.quantidade
      WHEN m.tipo = 'ajuste' THEN m.quantidade
      ELSE 0
    END
  ), 0) AS saldo_local
FROM public.estoque_movimentos m
JOIN public.estoque_itens i ON i.id = m.item_id
LEFT JOIN public.estoque_locais l ON l.id = m.local_id
WHERE m.local_id IS NOT NULL
GROUP BY m.tenant_id, m.item_id, m.local_id, i.nome, i.sku, i.unidade, l.nome;

-- 6. RPC: atomic transfer between locations
CREATE OR REPLACE FUNCTION public.estoque_transferir(
  p_tenant_id uuid,
  p_item_id uuid,
  p_local_origem uuid,
  p_local_destino uuid,
  p_quantidade numeric,
  p_user_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  
  INSERT INTO estoque_movimentos (tenant_id, item_id, local_id, tipo, quantidade, origem, observacao, created_by, ref_type, ref_id)
  VALUES (p_tenant_id, p_item_id, p_local_origem, 'saida', p_quantidade, 'manual', 
    COALESCE(p_observacao, 'Transferência para outro local'), p_user_id, 'transferencia', p_local_destino);
  
  INSERT INTO estoque_movimentos (tenant_id, item_id, local_id, tipo, quantidade, origem, observacao, created_by, ref_type, ref_id)
  VALUES (p_tenant_id, p_item_id, p_local_destino, 'entrada', p_quantidade, 'manual',
    COALESCE(p_observacao, 'Transferência de outro local'), p_user_id, 'transferencia', p_local_origem);
END;
$$;

-- 7. RPC: consume reservation (atomic: mark consumed + create OUT movement)
CREATE OR REPLACE FUNCTION public.estoque_consumir_reserva(
  p_reserva_id uuid,
  p_user_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva RECORD;
BEGIN
  SELECT * INTO v_reserva FROM estoque_reservas WHERE id = p_reserva_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada ou já consumida/cancelada';
  END IF;
  
  INSERT INTO estoque_movimentos (tenant_id, item_id, local_id, tipo, quantidade, origem, observacao, created_by, ref_type, ref_id)
  VALUES (v_reserva.tenant_id, v_reserva.item_id, v_reserva.local_id, 'saida', v_reserva.quantidade_reservada, 
    'project', COALESCE(p_observacao, 'Consumo de reserva'), p_user_id, v_reserva.ref_type, v_reserva.ref_id);
  
  UPDATE estoque_reservas SET status = 'consumed', consumed_at = now(), updated_at = now() WHERE id = p_reserva_id;
END;
$$;

-- 8. Update origem CHECK to allow new values
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS estoque_movimentos_origem_check;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_movimentos_origem_check 
  CHECK (origem IN ('purchase', 'project', 'adjustment', 'return', 'manual', 'transfer_in', 'transfer_out'));

-- 9. Update custo_medio trigger to be more robust
CREATE OR REPLACE FUNCTION public.update_custo_medio_on_entrada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_stock numeric;
  _current_custo numeric;
  _new_custo numeric;
BEGIN
  IF NEW.tipo = 'entrada' AND NEW.custo_unitario IS NOT NULL AND NEW.custo_unitario > 0 THEN
    SELECT
      COALESCE(SUM(
        CASE 
          WHEN tipo = 'entrada' THEN quantidade
          WHEN tipo = 'saida' THEN -quantidade
          WHEN tipo = 'ajuste' THEN quantidade
          ELSE 0
        END
      ), 0)
    INTO _current_stock
    FROM estoque_movimentos
    WHERE item_id = NEW.item_id AND tenant_id = NEW.tenant_id AND id != NEW.id;

    SELECT COALESCE(custo_medio, 0) INTO _current_custo FROM estoque_itens WHERE id = NEW.item_id;

    IF (_current_stock + NEW.quantidade) > 0 THEN
      _new_custo := ((_current_stock * _current_custo) + (NEW.quantidade * NEW.custo_unitario)) / (_current_stock + NEW.quantidade);
    ELSE
      _new_custo := NEW.custo_unitario;
    END IF;

    UPDATE estoque_itens SET custo_medio = ROUND(_new_custo, 4) WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;