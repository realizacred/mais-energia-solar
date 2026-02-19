
-- ============================================================
-- P0: CONTACTS TABLE + start_conversation_by_phone RPC
-- ============================================================

-- 1) contacts table (tenant-scoped)
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text,
  phone_e164 text NOT NULL,
  tags text[] DEFAULT '{}',
  source text DEFAULT 'manual',
  linked_cliente_id uuid REFERENCES public.clientes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contacts_tenant_phone_unique UNIQUE (tenant_id, phone_e164)
);

CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone_e164);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacts_select_tenant"
ON public.contacts FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "contacts_insert_tenant"
ON public.contacts FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = public.contacts.tenant_id
      AND role IN ('admin', 'gerente', 'consultor')
  )
);

CREATE POLICY "contacts_update_tenant"
ON public.contacts FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = public.contacts.tenant_id
      AND role IN ('admin', 'gerente', 'consultor')
  )
);

CREATE POLICY "contacts_delete_tenant"
ON public.contacts FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND tenant_id = public.contacts.tenant_id
      AND role IN ('admin', 'gerente')
  )
);

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) Canonical phone normalization helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.canonicalize_phone_br(raw_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF raw_phone IS NULL OR raw_phone = '' THEN RETURN NULL; END IF;
  digits := regexp_replace(raw_phone, '[^0-9]', '', 'g');
  IF NOT digits LIKE '55%' THEN
    digits := '55' || digits;
  END IF;
  IF length(digits) = 12 THEN
    digits := substring(digits, 1, 4) || '9' || substring(digits, 5);
  END IF;
  RETURN digits;
END;
$$;

-- ============================================================
-- 3) start_conversation_by_phone RPC (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_conversation_by_phone(
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

  -- 3. Upsert contact
  INSERT INTO contacts (tenant_id, phone_e164, name, source)
  VALUES (v_tenant_id, v_phone_e164, p_name_optional, 'manual')
  ON CONFLICT (tenant_id, phone_e164)
  DO UPDATE SET
    name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name),
    updated_at = now()
  RETURNING id INTO v_contact_id;

  -- 4. Resolve existing conversation
  SELECT id, instance_id INTO v_conversation_id, v_existing_instance
  FROM wa_conversations
  WHERE tenant_id = v_tenant_id
    AND (remote_jid = v_remote_jid OR telefone_normalized = v_phone_e164)
  ORDER BY
    CASE WHEN status = 'open' THEN 0 ELSE 1 END,
    updated_at DESC
  LIMIT 1;

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
    ORDER BY created_at ASC
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
      v_phone_e164, p_name_optional, v_user_id, 'open'
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
      p_idempotency_key := 'startchat:' || v_tenant_id::text || ':' || v_phone_e164 || ':' || md5(p_message_optional)
    );
  END IF;

  RETURN jsonb_build_object(
    'conversation_id', v_conversation_id,
    'contact_id', v_contact_id,
    'instance_id', v_instance_id,
    'remote_jid', v_remote_jid,
    'outbox_id', v_outbox_id
  );
END;
$$;
