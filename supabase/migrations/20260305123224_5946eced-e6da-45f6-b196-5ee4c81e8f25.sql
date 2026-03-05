
-- RPC for standalone reservation (not tied to projeto)
-- Validates available stock with advisory lock
CREATE OR REPLACE FUNCTION public.estoque_reservar_material_avulso(
  p_tenant_id uuid,
  p_item_id uuid,
  p_local_id uuid DEFAULT NULL,
  p_quantidade numeric DEFAULT 1,
  p_ref_type text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disponivel numeric;
  v_lock_key bigint;
  v_reserva_id uuid;
  v_tenant_id uuid;
  v_user_id uuid;
BEGIN
  v_tenant_id := public.current_tenant_id();
  v_user_id := auth.uid();

  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'No tenant in context'; END IF;
  IF p_tenant_id IS DISTINCT FROM v_tenant_id THEN RAISE EXCEPTION 'tenant mismatch'; END IF;
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'user mismatch'; END IF;
  IF p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;

  -- Lock
  v_lock_key := hashtext(v_tenant_id::text || p_item_id::text || COALESCE(p_local_id::text, ''));
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Validate available
  IF p_local_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade WHEN m.tipo='saida' THEN -m.quantidade WHEN m.tipo='ajuste' THEN m.ajuste_sinal*m.quantidade ELSE 0 END),0)
      - COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id=p_item_id AND r.local_id=p_local_id AND r.tenant_id=v_tenant_id AND r.status='active'),0)
    INTO v_disponivel
    FROM public.estoque_movimentos m WHERE m.item_id=p_item_id AND m.local_id=p_local_id AND m.tenant_id=v_tenant_id;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade WHEN m.tipo='saida' THEN -m.quantidade WHEN m.tipo='ajuste' THEN m.ajuste_sinal*m.quantidade ELSE 0 END),0)
      - COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id=p_item_id AND r.tenant_id=v_tenant_id AND r.status='active'),0)
    INTO v_disponivel
    FROM public.estoque_movimentos m WHERE m.item_id=p_item_id AND m.tenant_id=v_tenant_id;
  END IF;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, Solicitado: %', v_disponivel, p_quantidade;
  END IF;

  INSERT INTO public.estoque_reservas (tenant_id, item_id, local_id, quantidade_reservada, ref_type, ref_id, status, created_by, observacao)
  VALUES (v_tenant_id, p_item_id, p_local_id, p_quantidade, p_ref_type, p_ref_id, 'active', v_user_id, p_observacao)
  RETURNING id INTO v_reserva_id;

  RETURN v_reserva_id;
END;
$$;
