
-- ═══════════════════════════════════════════════════════════════
-- HARDENING: Auto-cleanup stuck processing versions + audit trail
-- ═══════════════════════════════════════════════════════════════

-- 1. Function to auto-fail stuck processing versions (>2 hours)
CREATE OR REPLACE FUNCTION public.cleanup_stuck_irradiance_versions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  WITH stuck AS (
    UPDATE irradiance_dataset_versions
    SET status = 'failed',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'),
          '{failure_reason}',
          '"Auto-cleanup: stuck in processing > 2 hours"'
        ),
        updated_at = now()
    WHERE status = 'processing'
      AND created_at < now() - interval '2 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM stuck;
  
  IF _count > 0 THEN
    RAISE LOG 'cleanup_stuck_irradiance_versions: marked % versions as failed', _count;
  END IF;
  
  RETURN _count;
END;
$$;

-- 2. Audit trigger for version lifecycle events
-- Uses existing audit_logs table with the session variable pattern
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
  -- Resolve a valid tenant_id for audit (use first admin's tenant or a system marker)
  SELECT p.tenant_id INTO _tenant_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role IN ('admin', 'super_admin')
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    -- Fallback: system-level, use first tenant
    SELECT id INTO _tenant_id FROM tenants WHERE status = 'active' LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _action := 'irradiance_version_created';
    -- Set session var so audit_logs guard allows it
    PERFORM set_config('app.audit_trigger_active', 'true', true);
    INSERT INTO audit_logs (tenant_id, tabela, acao, registro_id, dados_novos, user_id)
    VALUES (_tenant_id, 'irradiance_dataset_versions', _action, NEW.id::text,
            jsonb_build_object('version_tag', NEW.version_tag, 'status', NEW.status, 'dataset_id', NEW.dataset_id),
            auth.uid());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only log status transitions
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := 'irradiance_version_' || NEW.status;
      PERFORM set_config('app.audit_trigger_active', 'true', true);
      INSERT INTO audit_logs (tenant_id, tabela, acao, registro_id, dados_anteriores, dados_novos, user_id)
      VALUES (_tenant_id, 'irradiance_dataset_versions', _action, NEW.id::text,
              jsonb_build_object('old_status', OLD.status, 'version_tag', OLD.version_tag),
              jsonb_build_object('new_status', NEW.status, 'row_count', NEW.row_count),
              auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger
DROP TRIGGER IF EXISTS trg_audit_irradiance_version ON irradiance_dataset_versions;
CREATE TRIGGER trg_audit_irradiance_version
  AFTER INSERT OR UPDATE ON irradiance_dataset_versions
  FOR EACH ROW EXECUTE FUNCTION audit_irradiance_version_lifecycle();

-- 3. Allow guard_irradiance_version_immutability to accept processing → failed transition
-- (Already handled by existing trigger - just confirming deprecated status transition is allowed)
-- The existing trigger allows: processing → active, processing → failed, active → archived
-- We need to also allow: active → deprecated (used by irradiance-fetch)
CREATE OR REPLACE FUNCTION public.guard_irradiance_version_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow status transitions only
  IF OLD.status = 'processing' AND NEW.status IN ('active', 'failed') THEN
    -- Allow updating status, row_count, metadata, updated_at during finalization
    IF NEW.dataset_id IS DISTINCT FROM OLD.dataset_id
       OR NEW.version_tag IS DISTINCT FROM OLD.version_tag THEN
      RAISE EXCEPTION 'irradiance_dataset_versions: cannot change identity fields after creation'
        USING ERRCODE = 'P0403';
    END IF;
    RETURN NEW;
  END IF;

  -- Allow archiving/deprecating an active version
  IF OLD.status = 'active' AND NEW.status IN ('archived', 'deprecated') THEN
    RETURN NEW;
  END IF;

  -- Allow failing a processing version (for auto-cleanup)
  IF OLD.status = 'processing' AND NEW.status = 'failed' THEN
    RETURN NEW;
  END IF;

  -- Block everything else
  RAISE EXCEPTION 'irradiance_dataset_versions: published versions are immutable (status=%). Only status transitions allowed.', OLD.status
    USING ERRCODE = 'P0403';
END;
$$;
