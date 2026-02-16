
CREATE OR REPLACE FUNCTION public.audit_irradiance_version_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _action text;
  _tenant_id uuid;
BEGIN
  SELECT p.tenant_id INTO _tenant_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role IN ('admin', 'super_admin')
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    SELECT id INTO _tenant_id FROM tenants WHERE status = 'active' LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _action := 'irradiance_version_created';
    PERFORM set_config('app.audit_trigger_active', 'true', true);
    INSERT INTO audit_logs (tenant_id, tabela, acao, registro_id, dados_novos, user_id)
    VALUES (_tenant_id, 'irradiance_dataset_versions', _action, NEW.id,
            jsonb_build_object('version_tag', NEW.version_tag, 'status', NEW.status, 'dataset_id', NEW.dataset_id),
            auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'irradiance_version_' || NEW.status;
      PERFORM set_config('app.audit_trigger_active', 'true', true);
      INSERT INTO audit_logs (tenant_id, tabela, acao, registro_id, dados_anteriores, dados_novos, user_id)
      VALUES (_tenant_id, 'irradiance_dataset_versions', _action, NEW.id,
              jsonb_build_object('old_status', OLD.status, 'version_tag', OLD.version_tag),
              jsonb_build_object('new_status', NEW.status, 'row_count', NEW.row_count),
              auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
