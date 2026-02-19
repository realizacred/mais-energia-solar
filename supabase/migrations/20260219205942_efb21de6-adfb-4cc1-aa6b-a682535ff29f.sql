
-- ============================================================
-- P0 HARDENING: 3 correções enterprise WhatsApp Engine
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 5.1: RPC rpc_transfer_conversation — TRANSACIONAL ATÔMICO
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_transfer_conversation(
  p_conversation_id uuid,
  p_to_user_id uuid,
  p_reason text DEFAULT NULL,
  p_generate_summary boolean DEFAULT true,
  p_summary_msg_count integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _tenant_id uuid;
  _conv record;
  _from_name text;
  _to_name text;
  _summary text;
  _msgs_preview text;
  _transfer_id uuid;
  _note_id uuid;
BEGIN
  -- 1. Auth + tenant
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'rpc_transfer_conversation: auth required'
      USING ERRCODE = 'P0401';
  END IF;

  _tenant_id := get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'rpc_transfer_conversation: no tenant for user'
      USING ERRCODE = 'P0402';
  END IF;

  -- 2. Lock + read conversation (FOR UPDATE prevents concurrent modification)
  SELECT id, assigned_to, version, cliente_nome, cliente_telefone, tenant_id
  INTO _conv
  FROM wa_conversations
  WHERE id = p_conversation_id
    AND tenant_id = _tenant_id
  FOR UPDATE;

  IF _conv IS NULL THEN
    RAISE EXCEPTION 'rpc_transfer_conversation: conversation not found or access denied'
      USING ERRCODE = 'P0404';
  END IF;

  -- 3. Prevent self-transfer
  IF _conv.assigned_to = p_to_user_id THEN
    RAISE EXCEPTION 'rpc_transfer_conversation: already assigned to target user'
      USING ERRCODE = 'P0422';
  END IF;

  -- 4. Validate target user belongs to same tenant
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = p_to_user_id AND tenant_id = _tenant_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'rpc_transfer_conversation: target user not found in tenant'
      USING ERRCODE = 'P0404';
  END IF;

  -- 5. Insert transfer audit record
  INSERT INTO wa_transfers (conversation_id, from_user_id, to_user_id, reason, tenant_id)
  VALUES (p_conversation_id, COALESCE(_conv.assigned_to, _user_id), p_to_user_id, p_reason, _tenant_id)
  RETURNING id INTO _transfer_id;

  -- 6. Update conversation atomically (version incremented by trigger)
  UPDATE wa_conversations
  SET assigned_to = p_to_user_id,
      status = 'open',
      updated_at = now()
  WHERE id = p_conversation_id
    AND tenant_id = _tenant_id;

  -- 7. Generate handoff summary (backend-side, never frontend)
  IF p_generate_summary THEN
    -- Resolve names
    SELECT nome INTO _from_name FROM profiles WHERE user_id = COALESCE(_conv.assigned_to, _user_id) LIMIT 1;
    SELECT nome INTO _to_name FROM profiles WHERE user_id = p_to_user_id LIMIT 1;

    -- Build message preview from last N messages
    SELECT string_agg(
      CASE WHEN m.direction = 'in' THEN '👤 ' ELSE '💬 ' END
      || COALESCE(left(m.content, 60), '[' || m.message_type || ']'),
      E'\n'
      ORDER BY m.created_at ASC
    )
    INTO _msgs_preview
    FROM (
      SELECT direction, content, message_type, created_at
      FROM wa_messages
      WHERE conversation_id = p_conversation_id
        AND is_internal_note = false
      ORDER BY created_at DESC
      LIMIT p_summary_msg_count
    ) m;

    _summary := '🔄 *Transferência de atendimento*' || E'\n'
      || 'De: ' || COALESCE(_from_name, 'Não atribuído') || ' → Para: ' || COALESCE(_to_name, 'Desconhecido') || E'\n'
      || CASE WHEN p_reason IS NOT NULL THEN 'Motivo: ' || p_reason || E'\n' ELSE '' END
      || 'Cliente: ' || COALESCE(_conv.cliente_nome, _conv.cliente_telefone) || E'\n'
      || E'\n📋 *Últimas mensagens:*\n'
      || COALESCE(_msgs_preview, '(sem mensagens recentes)');

    INSERT INTO wa_messages (
      conversation_id, tenant_id, direction, message_type, content,
      sent_by_user_id, is_internal_note, status, source
    )
    VALUES (
      p_conversation_id, _tenant_id, 'out', 'text', _summary,
      _user_id, true, 'sent', 'system'
    )
    RETURNING id INTO _note_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'transfer_id', _transfer_id,
    'conversation_id', p_conversation_id,
    'from_user_id', _conv.assigned_to,
    'to_user_id', p_to_user_id,
    'new_version', _conv.version + 1,
    'summary_note_id', _note_id
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 5.2a: Advisory lock functions for process-wa-outbox
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.try_outbox_lock()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN pg_try_advisory_lock(hashtext('process-wa-outbox'));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_outbox_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext('process-wa-outbox'));
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 5.2b: Idempotency key on wa_outbox
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.wa_outbox
ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_outbox_idempotency
ON public.wa_outbox (tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 5.3: Backfill telefone_normalized NULLs
-- ═══════════════════════════════════════════════════════════

UPDATE public.wa_conversations
SET telefone_normalized = normalize_br_phone(cliente_telefone)
WHERE telefone_normalized IS NULL
  AND cliente_telefone IS NOT NULL
  AND is_group = false;

-- Add created_by to wa_transfers for full audit trail
ALTER TABLE public.wa_transfers
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
