
-- 1) Update rpc_recall_or_start_conversation to:
--    a) Set source='whatsapp' and display_name
--    b) Upsert contact_identities
--    c) Set default role 'cliente'

CREATE OR REPLACE FUNCTION public.rpc_recall_or_start_conversation(
  p_phone_raw text,
  p_name_optional text DEFAULT NULL,
  p_message_optional text DEFAULT NULL,
  p_instance_preference uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_phone_e164 text;
  v_remote_jid text;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_instance_id uuid;
  v_existing_instance uuid;
  v_outbox_id uuid;
  v_reused boolean := false;
  v_display text;
BEGIN
  -- 1. Resolve tenant
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with a tenant';
  END IF;

  -- 2. Canonicalize phone
  v_phone_e164 := canonicalize_phone_br(p_phone_raw);
  IF v_phone_e164 IS NULL OR length(v_phone_e164) < 12 THEN
    RAISE EXCEPTION 'Invalid phone number: %', p_phone_raw;
  END IF;
  v_remote_jid := v_phone_e164 || '@s.whatsapp.net';
  v_display := COALESCE(NULLIF(trim(p_name_optional), ''), '');

  -- 3. Upsert contact (source=whatsapp, default role, display_name)
  INSERT INTO contacts (tenant_id, phone_e164, name, display_name, source, roles)
  VALUES (v_tenant_id, v_phone_e164, v_display, NULLIF(v_display, ''), 'whatsapp', '["cliente"]'::jsonb)
  ON CONFLICT (tenant_id, phone_e164)
  DO UPDATE SET
    name = CASE WHEN contacts.name IS NULL OR contacts.name = ''
                THEN COALESCE(NULLIF(v_display, ''), contacts.name)
                ELSE contacts.name END,
    display_name = CASE WHEN contacts.display_name IS NULL OR contacts.display_name = ''
                THEN COALESCE(NULLIF(v_display, ''), contacts.display_name)
                ELSE contacts.display_name END,
    last_interaction_at = now(),
    updated_at = now()
  RETURNING id INTO v_contact_id;

  -- 3b. Upsert contact_identities for phone_e164
  INSERT INTO contact_identities (tenant_id, contact_id, identity_type, identity_value, is_primary)
  VALUES (v_tenant_id, v_contact_id, 'phone_e164', v_phone_e164, true)
  ON CONFLICT (tenant_id, identity_type, identity_value)
  DO UPDATE SET contact_id = EXCLUDED.contact_id, is_primary = true;

  -- 4. Resolve existing conversation
  SELECT id, instance_id INTO v_conversation_id, v_existing_instance
  FROM wa_conversations
  WHERE tenant_id = v_tenant_id
    AND (remote_jid = v_remote_jid OR telefone_normalized = v_phone_e164)
  ORDER BY
    CASE WHEN status = 'open' THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    v_reused := true;
  END IF;

  -- 5. Instance routing
  IF v_existing_instance IS NOT NULL THEN
    v_instance_id := v_existing_instance;
  ELSIF p_instance_preference IS NOT NULL THEN
    SELECT id INTO v_instance_id
    FROM wa_instances
    WHERE id = p_instance_preference
      AND tenant_id = v_tenant_id
      AND status = 'connected';
  END IF;

  IF v_instance_id IS NULL THEN
    SELECT id INTO v_instance_id
    FROM wa_instances
    WHERE tenant_id = v_tenant_id AND status = 'connected'
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'No connected WhatsApp instance available';
  END IF;

  -- 6. Create or reopen conversation
  IF v_conversation_id IS NOT NULL THEN
    UPDATE wa_conversations
    SET status = 'open', updated_at = now()
    WHERE id = v_conversation_id AND status != 'open';
  ELSE
    INSERT INTO wa_conversations (
      tenant_id, instance_id, remote_jid, telefone_normalized,
      cliente_telefone, cliente_nome, assigned_to, status
    ) VALUES (
      v_tenant_id, v_instance_id, v_remote_jid, v_phone_e164,
      v_phone_e164, COALESCE(NULLIF(trim(p_name_optional), ''), null), v_user_id, 'open'
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  -- 7. Enqueue message if provided
  IF p_message_optional IS NOT NULL AND length(trim(p_message_optional)) > 0 THEN
    v_outbox_id := enqueue_wa_outbox_item(
      p_tenant_id := v_tenant_id,
      p_instance_id := v_instance_id,
      p_remote_jid := v_remote_jid,
      p_message_type := 'text',
      p_content := p_message_optional,
      p_conversation_id := v_conversation_id,
      p_idempotency_key := 'recall:' || v_tenant_id::text || ':' || v_phone_e164 || ':' || md5(p_message_optional)
    );
  END IF;

  -- 8. Best-effort ops log
  BEGIN
    INSERT INTO wa_ops_events (tenant_id, instance_id, event_type, payload)
    VALUES (v_tenant_id, v_instance_id, 'recall_conversation', jsonb_build_object(
      'phone_e164', v_phone_e164,
      'conversation_id', v_conversation_id,
      'reused', v_reused,
      'user_id', v_user_id
    ));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'conversation_id', v_conversation_id,
    'contact_id', v_contact_id,
    'instance_id', v_instance_id,
    'remote_jid', v_remote_jid,
    'outbox_id', v_outbox_id,
    'reused', v_reused
  );
END;
$$;

-- Also update the trigger that auto-creates contacts from wa_conversations
CREATE OR REPLACE FUNCTION public.sync_wa_conversation_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _phone text;
  _contact_id uuid;
BEGIN
  _phone := COALESCE(NEW.telefone_normalized, NEW.cliente_telefone);
  IF _phone IS NULL OR length(_phone) < 10 THEN
    RETURN NEW;
  END IF;

  -- Upsert contact
  INSERT INTO public.contacts (tenant_id, phone_e164, name, display_name, source, last_interaction_at, roles)
  VALUES (
    NEW.tenant_id,
    _phone,
    COALESCE(NULLIF(NEW.cliente_nome, ''), ''),
    COALESCE(NULLIF(NEW.cliente_nome, ''), NULL),
    'whatsapp',
    now(),
    '["cliente"]'::jsonb
  )
  ON CONFLICT (tenant_id, phone_e164)
  DO UPDATE SET
    name = CASE WHEN contacts.name IS NULL OR contacts.name = ''
                THEN COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name)
                ELSE contacts.name END,
    display_name = CASE WHEN contacts.display_name IS NULL OR contacts.display_name = ''
                THEN COALESCE(NULLIF(EXCLUDED.display_name, ''), contacts.display_name)
                ELSE contacts.display_name END,
    last_interaction_at = now(),
    updated_at = now()
  RETURNING id INTO _contact_id;

  -- Upsert contact_identities
  IF _contact_id IS NOT NULL THEN
    INSERT INTO contact_identities (tenant_id, contact_id, identity_type, identity_value, is_primary)
    VALUES (NEW.tenant_id, _contact_id, 'phone_e164', _phone, true)
    ON CONFLICT (tenant_id, identity_type, identity_value)
    DO UPDATE SET contact_id = EXCLUDED.contact_id, is_primary = true;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
