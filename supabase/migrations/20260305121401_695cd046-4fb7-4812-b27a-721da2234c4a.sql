
-- Drop old estoque_transferir (return type changed void -> uuid)
DROP FUNCTION IF EXISTS public.estoque_transferir(uuid, uuid, uuid, uuid, numeric, uuid, text);

-- Recreate with uuid return
CREATE OR REPLACE FUNCTION public.estoque_transferir(
  p_tenant_id uuid,
  p_item_id uuid,
  p_local_origem uuid,
  p_local_destino uuid,
  p_quantidade numeric,
  p_user_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disponivel numeric;
  v_lock_key_orig bigint;
  v_lock_key_dest bigint;
  v_transfer_id uuid := gen_random_uuid();
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;
  IF p_local_origem = p_local_destino THEN
    RAISE EXCEPTION 'Origem e destino devem ser diferentes';
  END IF;

  -- Lock in consistent order
  IF p_local_origem < p_local_destino THEN
    v_lock_key_orig := hashtext(p_tenant_id::text || p_item_id::text || p_local_origem::text);
    v_lock_key_dest := hashtext(p_tenant_id::text || p_item_id::text || p_local_destino::text);
  ELSE
    v_lock_key_orig := hashtext(p_tenant_id::text || p_item_id::text || p_local_destino::text);
    v_lock_key_dest := hashtext(p_tenant_id::text || p_item_id::text || p_local_origem::text);
  END IF;
  PERFORM pg_advisory_xact_lock(v_lock_key_orig);
  PERFORM pg_advisory_xact_lock(v_lock_key_dest);

  -- Validate stock at origin
  SELECT
    COALESCE(SUM(
      CASE WHEN m.tipo = 'entrada' THEN m.quantidade WHEN m.tipo = 'saida' THEN -m.quantidade WHEN m.tipo = 'ajuste' THEN m.ajuste_sinal * m.quantidade ELSE 0 END
    ), 0)
    - COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id = p_item_id AND r.local_id = p_local_origem AND r.tenant_id = p_tenant_id AND r.status = 'active'), 0)
  INTO v_disponivel
  FROM public.estoque_movimentos m
  WHERE m.item_id = p_item_id AND m.local_id = p_local_origem AND m.tenant_id = p_tenant_id;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente na origem. Disponível: %, Solicitado: %', v_disponivel, p_quantidade;
  END IF;

  INSERT INTO public.estoque_movimentos (tenant_id, item_id, local_id, tipo, quantidade, origem, observacao, created_by, ref_type, ref_id, ajuste_sinal)
  VALUES (p_tenant_id, p_item_id, p_local_origem, 'saida', p_quantidade, 'transfer_out',
    COALESCE(p_observacao, 'Transferência para outro local'), p_user_id, 'transfer', v_transfer_id, 1);

  INSERT INTO public.estoque_movimentos (tenant_id, item_id, local_id, tipo, quantidade, origem, observacao, created_by, ref_type, ref_id, ajuste_sinal)
  VALUES (p_tenant_id, p_item_id, p_local_destino, 'entrada', p_quantidade, 'transfer_in',
    COALESCE(p_observacao, 'Transferência de outro local'), p_user_id, 'transfer', v_transfer_id, 1);

  RETURN v_transfer_id;
END;
$$;

-- Also create the projeto RPCs that were in the failed migration
CREATE OR REPLACE FUNCTION public.estoque_reservar_material_projeto(
  p_tenant_id uuid, p_projeto_id uuid, p_item_id uuid, p_local_id uuid, p_quantidade numeric, p_user_id uuid
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disponivel numeric; v_lock_key bigint; v_reserva_id uuid; v_material_id uuid;
BEGIN
  IF p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;
  v_lock_key := hashtext(p_tenant_id::text || p_item_id::text || COALESCE(p_local_id::text, ''));
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_local_id IS NOT NULL THEN
    SELECT COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade WHEN m.tipo='saida' THEN -m.quantidade WHEN m.tipo='ajuste' THEN m.ajuste_sinal*m.quantidade ELSE 0 END),0)
      - COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id=p_item_id AND r.local_id=p_local_id AND r.tenant_id=p_tenant_id AND r.status='active'),0)
    INTO v_disponivel FROM public.estoque_movimentos m WHERE m.item_id=p_item_id AND m.local_id=p_local_id AND m.tenant_id=p_tenant_id;
  ELSE
    SELECT COALESCE(SUM(CASE WHEN m.tipo='entrada' THEN m.quantidade WHEN m.tipo='saida' THEN -m.quantidade WHEN m.tipo='ajuste' THEN m.ajuste_sinal*m.quantidade ELSE 0 END),0)
      - COALESCE((SELECT SUM(r.quantidade_reservada) FROM public.estoque_reservas r WHERE r.item_id=p_item_id AND r.tenant_id=p_tenant_id AND r.status='active'),0)
    INTO v_disponivel FROM public.estoque_movimentos m WHERE m.item_id=p_item_id AND m.tenant_id=p_tenant_id;
  END IF;

  IF v_disponivel < p_quantidade THEN RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, Solicitado: %', v_disponivel, p_quantidade; END IF;

  INSERT INTO public.estoque_reservas (tenant_id, item_id, local_id, quantidade_reservada, ref_type, ref_id, status, created_by, observacao)
  VALUES (p_tenant_id, p_item_id, p_local_id, p_quantidade, 'projeto', p_projeto_id, 'active', p_user_id, 'Reserva automática para projeto')
  RETURNING id INTO v_reserva_id;

  INSERT INTO public.projeto_materiais (tenant_id, projeto_id, item_id, local_id, quantidade, reserva_id, status, created_by)
  VALUES (p_tenant_id, p_projeto_id, p_item_id, p_local_id, p_quantidade, v_reserva_id, 'reservado', p_user_id)
  RETURNING id INTO v_material_id;

  RETURN v_material_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_consumir_projeto(p_projeto_id uuid, p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mat RECORD; v_count integer := 0;
BEGIN
  FOR v_mat IN SELECT pm.id, pm.reserva_id FROM public.projeto_materiais pm WHERE pm.projeto_id = p_projeto_id AND pm.status = 'reservado' AND pm.reserva_id IS NOT NULL
  LOOP
    PERFORM public.estoque_consumir_reserva(v_mat.reserva_id, p_user_id, 'Consumo automático - projeto finalizado');
    UPDATE public.projeto_materiais SET status = 'consumido', updated_at = now() WHERE id = v_mat.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_cancelar_reservas_projeto(p_projeto_id uuid, p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mat RECORD; v_count integer := 0;
BEGIN
  FOR v_mat IN SELECT pm.id, pm.reserva_id FROM public.projeto_materiais pm WHERE pm.projeto_id = p_projeto_id AND pm.status = 'reservado' AND pm.reserva_id IS NOT NULL
  LOOP
    UPDATE public.estoque_reservas SET status = 'cancelled', updated_at = now() WHERE id = v_mat.reserva_id;
    UPDATE public.projeto_materiais SET status = 'cancelado', updated_at = now() WHERE id = v_mat.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
