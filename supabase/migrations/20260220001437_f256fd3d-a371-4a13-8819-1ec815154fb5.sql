
-- Trigger to sync leads to contacts table (agenda do consultor)
-- Normalizes phone to E.164 format (55 + number)
CREATE OR REPLACE FUNCTION public.sync_lead_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone TEXT;
  _digits TEXT;
BEGIN
  -- Get normalized phone
  _digits := regexp_replace(COALESCE(NEW.telefone_normalized, NEW.telefone, ''), '\D', '', 'g');
  
  IF _digits = '' OR length(_digits) < 10 THEN
    RETURN NEW;
  END IF;
  
  -- Ensure E.164 with country code 55
  IF NOT _digits LIKE '55%' THEN
    _phone := '55' || _digits;
  ELSE
    _phone := _digits;
  END IF;
  
  -- Insert 9-digit mobile if 12 digits (missing 9)
  IF length(_phone) = 12 THEN
    _phone := substring(_phone, 1, 4) || '9' || substring(_phone, 5);
  END IF;
  
  -- Upsert into contacts
  INSERT INTO public.contacts (tenant_id, phone_e164, name, source, last_interaction_at)
  VALUES (NEW.tenant_id, _phone, NEW.nome, 'lead', now())
  ON CONFLICT (tenant_id, phone_e164)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    last_interaction_at = GREATEST(contacts.last_interaction_at, now());
  
  RETURN NEW;
END;
$$;

-- Trigger on leads INSERT and UPDATE
CREATE TRIGGER trg_sync_lead_to_contact
AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW
WHEN (NEW.telefone IS NOT NULL AND NEW.telefone != '')
EXECUTE FUNCTION public.sync_lead_to_contact();

-- Backfill: sync existing leads to contacts
INSERT INTO public.contacts (tenant_id, phone_e164, name, source, last_interaction_at)
SELECT 
  l.tenant_id,
  CASE 
    WHEN length(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g')) = 12
      AND NOT regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g') LIKE '55%'
    THEN '55' || substring(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g'), 1, 2) || '9' || substring(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g'), 3)
    WHEN NOT regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g') LIKE '55%'
    THEN CASE 
      WHEN length(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g')) = 10
      THEN '55' || substring(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g'), 1, 2) || '9' || substring(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g'), 3)
      ELSE '55' || regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g')
    END
    ELSE regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g')
  END AS phone_e164,
  l.nome,
  'lead',
  COALESCE(l.created_at, now())
FROM leads l
WHERE l.telefone IS NOT NULL AND l.telefone != ''
  AND length(regexp_replace(COALESCE(l.telefone_normalized, l.telefone), '\D', '', 'g')) >= 10
ON CONFLICT (tenant_id, phone_e164)
DO UPDATE SET
  name = COALESCE(EXCLUDED.name, contacts.name),
  last_interaction_at = GREATEST(contacts.last_interaction_at, EXCLUDED.last_interaction_at);
