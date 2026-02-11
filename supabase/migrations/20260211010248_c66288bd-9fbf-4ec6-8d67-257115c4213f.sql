
-- Function: assign wa conversation to the calling vendor by phone number
-- SECURITY DEFINER to bypass RLS (vendor might not have access to unassigned convos)
-- NEVER changes instance_id
CREATE OR REPLACE FUNCTION public.assign_wa_conversation_by_phone(
  _phone_digits TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id UUID;
  _user_id UUID;
  _conv_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  _tenant_id := get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find first matching conversation by normalized phone (last 10-11 digits)
  -- Match against remote_jid digits
  SELECT c.id INTO _conv_id
  FROM wa_conversations c
  WHERE c.tenant_id = _tenant_id
    AND c.is_group = false
    AND (
      -- remote_jid contains the phone digits (e.g. 5532998437675@s.whatsapp.net)
      regexp_replace(c.remote_jid, '[^0-9]', '', 'g') LIKE '%' || RIGHT(_phone_digits, 11)
      OR regexp_replace(COALESCE(c.cliente_telefone, ''), '[^0-9]', '', 'g') LIKE '%' || RIGHT(_phone_digits, 11)
    )
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT 1;

  IF _conv_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Assign conversation to vendor and open it
  -- NEVER changes instance_id
  UPDATE wa_conversations
  SET assigned_to = _user_id,
      status = 'open',
      updated_at = now()
  WHERE id = _conv_id
    AND tenant_id = _tenant_id;

  RETURN _conv_id;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.assign_wa_conversation_by_phone(TEXT) IS
  'Assigns a WA conversation to the calling vendor by matching phone digits. '
  'Used after lead creation to auto-assign. NEVER changes instance_id.';
