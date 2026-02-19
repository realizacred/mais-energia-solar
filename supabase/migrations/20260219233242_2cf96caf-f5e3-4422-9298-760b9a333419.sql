
-- 1) Backfill: insert contacts from existing wa_conversations (dedup by phone+tenant)
INSERT INTO public.contacts (tenant_id, name, phone_e164, source, last_interaction_at, created_at, updated_at)
SELECT DISTINCT ON (c.tenant_id, c.cliente_telefone)
  c.tenant_id,
  c.cliente_nome,
  c.cliente_telefone,
  'whatsapp',
  c.updated_at,
  c.created_at,
  c.updated_at
FROM wa_conversations c
WHERE c.cliente_telefone IS NOT NULL
  AND c.cliente_telefone != ''
  AND NOT EXISTS (
    SELECT 1 FROM contacts ct
    WHERE ct.tenant_id = c.tenant_id AND ct.phone_e164 = c.cliente_telefone
  )
ORDER BY c.tenant_id, c.cliente_telefone, c.updated_at DESC;

-- 2) Function to auto-create contact on new wa_conversation
CREATE OR REPLACE FUNCTION public.sync_wa_conversation_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.contacts (tenant_id, name, phone_e164, source, last_interaction_at)
  VALUES (
    NEW.tenant_id,
    NEW.cliente_nome,
    NEW.cliente_telefone,
    'whatsapp',
    NEW.updated_at
  )
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    last_interaction_at = GREATEST(EXCLUDED.last_interaction_at, contacts.last_interaction_at),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 3) Trigger on wa_conversations INSERT and UPDATE
CREATE TRIGGER trg_sync_wa_to_contact
AFTER INSERT OR UPDATE ON public.wa_conversations
FOR EACH ROW
WHEN (NEW.cliente_telefone IS NOT NULL AND NEW.cliente_telefone != '')
EXECUTE FUNCTION public.sync_wa_conversation_to_contact();
