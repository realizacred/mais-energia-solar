
-- Fix audit_log_trigger_fn to resolve tenant_id from the record being audited
-- This fixes the NOT NULL violation when Edge Functions use service_role (no auth context)
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    'anonymous'
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

  -- Resolve tenant_id: prefer auth context, then fall back to the record's own tenant_id
  _tenant_id := get_user_tenant_id(_user_id);
  IF _tenant_id IS NULL THEN
    -- Try to extract tenant_id from the record being audited
    IF TG_OP = 'DELETE' THEN
      _tenant_id := (_old_data->>'tenant_id')::uuid;
    ELSE
      _tenant_id := (_new_data->>'tenant_id')::uuid;
    END IF;
  END IF;

  -- If still NULL, skip audit (better than crashing the operation)
  IF _tenant_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  PERFORM set_config('app.audit_trigger_active', 'true', true);

  INSERT INTO audit_logs (
    user_id,
    user_email,
    tabela,
    acao,
    registro_id,
    dados_anteriores,
    dados_novos,
    tenant_id,
    created_at
  ) VALUES (
    _user_id,
    _user_email,
    TG_TABLE_NAME,
    TG_OP,
    _record_id,
    _old_data,
    _new_data,
    _tenant_id,
    now()
  );

  PERFORM set_config('app.audit_trigger_active', 'false', true);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;
