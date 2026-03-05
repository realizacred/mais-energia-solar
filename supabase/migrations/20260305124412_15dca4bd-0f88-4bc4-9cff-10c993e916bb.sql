-- Drop the OLD overload (7 args, without p_tenant_id) to remove ambiguity
DROP FUNCTION IF EXISTS public.estoque_reservar_material_avulso(uuid, uuid, numeric, text, uuid, text, uuid);

-- Create RPC for cancelling a single reservation (atomic, with lock)
CREATE OR REPLACE FUNCTION public.estoque_cancelar_reserva(
  p_reserva_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserva estoque_reservas%ROWTYPE;
BEGIN
  -- Lock the reservation row
  SELECT * INTO v_reserva
  FROM estoque_reservas
  WHERE id = p_reserva_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada';
  END IF;

  -- Validate tenant
  IF v_reserva.tenant_id != current_tenant_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Only active reservations can be cancelled
  IF v_reserva.status != 'active' THEN
    RAISE EXCEPTION 'Reserva não está ativa (status atual: %)', v_reserva.status;
  END IF;

  UPDATE estoque_reservas
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_reserva_id;
END;
$$;