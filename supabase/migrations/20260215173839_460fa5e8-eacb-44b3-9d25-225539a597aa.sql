-- Add permission enforcement to move_deal_to_stage
CREATE OR REPLACE FUNCTION public.move_deal_to_stage(_deal_id uuid, _to_stage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tenant UUID;
  _from_stage UUID;
  _user UUID;
  _perm RECORD;
  _user_role TEXT;
  _deal_owner UUID;
BEGIN
  _user := auth.uid();
  _tenant := get_user_tenant_id(_user);

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant não resolvido' USING ERRCODE = 'P0401';
  END IF;

  -- Lock row to prevent race conditions
  SELECT stage_id, owner_id INTO _from_stage, _deal_owner
  FROM deals
  WHERE id = _deal_id AND tenant_id = _tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal não encontrado ou sem permissão' USING ERRCODE = 'P0404';
  END IF;

  -- Idempotency: already in target stage
  IF _from_stage = _to_stage_id THEN
    RETURN jsonb_build_object('status', 'noop', 'deal_id', _deal_id);
  END IF;

  -- Validate target stage belongs to same pipeline
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    JOIN deals d ON d.pipeline_id = ps.pipeline_id
    WHERE ps.id = _to_stage_id AND d.id = _deal_id
      AND ps.tenant_id = _tenant
  ) THEN
    RAISE EXCEPTION 'Stage inválido para este pipeline' USING ERRCODE = 'P0400';
  END IF;

  -- ═══ PERMISSION ENFORCEMENT ═══
  -- Check if target stage has restrictions
  SELECT restricao_tipo, allowed_roles, allowed_user_ids
  INTO _perm
  FROM pipeline_stage_permissions
  WHERE stage_id = _to_stage_id AND tenant_id = _tenant
  LIMIT 1;

  IF _perm IS NOT NULL AND _perm.restricao_tipo IS DISTINCT FROM 'todos' THEN
    IF _perm.restricao_tipo = 'apenas_responsavel' THEN
      -- Only the deal owner can move to this stage
      IF _deal_owner IS DISTINCT FROM _user THEN
        -- Check if user is admin (admins bypass owner restriction)
        IF NOT is_admin(_user) THEN
          RAISE EXCEPTION 'Permissão negada: apenas o responsável pode mover para esta etapa'
            USING ERRCODE = 'P0403';
        END IF;
      END IF;
    ELSIF _perm.restricao_tipo = 'por_papel' THEN
      -- Check if user has an allowed role
      IF NOT EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = _user
          AND ur.role::text = ANY(_perm.allowed_roles)
      ) THEN
        -- Admins always pass
        IF NOT is_admin(_user) THEN
          RAISE EXCEPTION 'Permissão negada: seu papel não tem acesso a esta etapa'
            USING ERRCODE = 'P0403';
        END IF;
      END IF;
    ELSIF _perm.restricao_tipo = 'usuarios_especificos' THEN
      IF NOT (_user = ANY(_perm.allowed_user_ids)) THEN
        IF NOT is_admin(_user) THEN
          RAISE EXCEPTION 'Permissão negada: você não está na lista de usuários permitidos'
            USING ERRCODE = 'P0403';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update deal (trigger syncs projection)
  UPDATE deals
  SET stage_id = _to_stage_id, updated_at = now()
  WHERE id = _deal_id AND tenant_id = _tenant;

  -- Audit (append-only)
  INSERT INTO deal_stage_history (tenant_id, deal_id, from_stage_id, to_stage_id, moved_by)
  VALUES (_tenant, _deal_id, _from_stage, _to_stage_id, _user);

  RETURN jsonb_build_object(
    'status', 'moved',
    'deal_id', _deal_id,
    'from', _from_stage,
    'to', _to_stage_id
  );
END;
$function$;