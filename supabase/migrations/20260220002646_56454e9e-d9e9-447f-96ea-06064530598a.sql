
-- 1. Add owner_user_id column
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id);

-- 2. Backfill from leads (lead's consultor user_id)
UPDATE public.contacts c
SET owner_user_id = cons.user_id
FROM public.leads l
JOIN public.consultores cons ON cons.id = l.consultor_id
WHERE c.linked_cliente_id IS NULL
  AND c.owner_user_id IS NULL
  AND c.tenant_id = l.tenant_id
  AND c.phone_e164 = COALESCE(l.telefone_normalized, regexp_replace(l.telefone, '\D', '', 'g'));

-- 3. Backfill from wa_conversations (assigned user)
UPDATE public.contacts c
SET owner_user_id = wc.assigned_to
FROM public.wa_conversations wc
WHERE c.owner_user_id IS NULL
  AND c.tenant_id = wc.tenant_id
  AND c.phone_e164 = wc.cliente_telefone
  AND wc.assigned_to IS NOT NULL;

-- 4. Update sync_lead_to_contact to set owner_user_id
CREATE OR REPLACE FUNCTION public.sync_lead_to_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _phone TEXT;
  _digits TEXT;
  _owner_uid UUID;
BEGIN
  _digits := regexp_replace(COALESCE(NEW.telefone_normalized, NEW.telefone, ''), '\D', '', 'g');
  
  IF _digits = '' OR length(_digits) < 10 THEN
    RETURN NEW;
  END IF;
  
  IF NOT _digits LIKE '55%' THEN
    _phone := '55' || _digits;
  ELSE
    _phone := _digits;
  END IF;
  
  IF length(_phone) = 12 THEN
    _phone := substring(_phone, 1, 4) || '9' || substring(_phone, 5);
  END IF;

  -- Resolve owner from consultor
  SELECT user_id INTO _owner_uid
  FROM public.consultores
  WHERE id = NEW.consultor_id;
  
  INSERT INTO public.contacts (tenant_id, phone_e164, name, source, last_interaction_at, owner_user_id)
  VALUES (NEW.tenant_id, _phone, NEW.nome, 'lead', now(), _owner_uid)
  ON CONFLICT (tenant_id, phone_e164)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    last_interaction_at = GREATEST(contacts.last_interaction_at, now()),
    owner_user_id = COALESCE(EXCLUDED.owner_user_id, contacts.owner_user_id);
  
  RETURN NEW;
END;
$function$;

-- 5. Update sync_wa_conversation_to_contact to set owner_user_id
CREATE OR REPLACE FUNCTION public.sync_wa_conversation_to_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.contacts (tenant_id, name, phone_e164, source, last_interaction_at, owner_user_id)
  VALUES (
    NEW.tenant_id,
    NEW.cliente_nome,
    NEW.cliente_telefone,
    'whatsapp',
    NEW.updated_at,
    NEW.assigned_to
  )
  ON CONFLICT (tenant_id, phone_e164) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    last_interaction_at = GREATEST(EXCLUDED.last_interaction_at, contacts.last_interaction_at),
    owner_user_id = COALESCE(EXCLUDED.owner_user_id, contacts.owner_user_id),
    updated_at = now();
  RETURN NEW;
END;
$function$;

-- 6. Update RLS: consultores only see their own contacts
DROP POLICY IF EXISTS contacts_select_tenant ON public.contacts;
CREATE POLICY contacts_select_tenant ON public.contacts
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    -- Admin/gerente/financeiro see all
    is_admin(auth.uid())
    OR
    -- Consultor sees only their own
    owner_user_id = auth.uid()
  )
);

-- 7. Index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_owner_user_id ON public.contacts(owner_user_id);
