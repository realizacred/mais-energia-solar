
-- 1) Fix the trigger function for future entries
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _old_data JSONB;
  _new_data JSONB;
  _record_id UUID;
  _tenant_id UUID;
BEGIN
  _user_id := auth.uid();
  
  _user_email := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', ''),
    auth.email(),
    (SELECT email FROM auth.users WHERE id = _user_id),
    CASE WHEN _user_id IS NOT NULL THEN _user_id::text ELSE 'sistema' END
  );

  IF TG_OP = 'DELETE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := NULL;
    _record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    _old_data := NULL;
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  END IF;

  _tenant_id := get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      _tenant_id := (_old_data->>'tenant_id')::uuid;
    ELSE
      _tenant_id := (_new_data->>'tenant_id')::uuid;
    END IF;
  END IF;

  IF _tenant_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM set_config('app.audit_trigger_active', 'true', true);

  INSERT INTO audit_logs (
    user_id, user_email, tabela, acao, registro_id,
    dados_anteriores, dados_novos, tenant_id, created_at
  ) VALUES (
    _user_id, _user_email, TG_TABLE_NAME, TG_OP, _record_id,
    _old_data, _new_data, _tenant_id, now()
  );

  PERFORM set_config('app.audit_trigger_active', 'false', true);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- 2) Temporarily disable immutability trigger for backfill
ALTER TABLE audit_logs DISABLE TRIGGER prevent_audit_log_update;

-- 3) Backfill anonymous entries
UPDATE audit_logs al
SET user_email = COALESCE(
  (SELECT email FROM auth.users WHERE id = al.user_id),
  'sistema'
)
WHERE al.user_email = 'anonymous' AND al.user_id IS NOT NULL;

UPDATE audit_logs
SET user_email = 'sistema'
WHERE user_email = 'anonymous' AND user_id IS NULL;

-- 4) Re-enable immutability trigger
ALTER TABLE audit_logs ENABLE TRIGGER prevent_audit_log_update;
