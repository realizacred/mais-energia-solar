
-- ═══════════════════════════════════════════════════════════
-- FASE 1: CONTENÇÃO — Motor de Funil (Deal Pipeline)
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Trigger de cleanup: DELETE em deals → remove da projection ───
CREATE OR REPLACE FUNCTION public.cleanup_deal_kanban_on_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM deal_kanban_projection WHERE deal_id = OLD.id;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_cleanup_deal_kanban
  AFTER DELETE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_deal_kanban_on_delete();

-- ─── 2. RPC move_deal_to_owner com row locking + auditoria ───
CREATE OR REPLACE FUNCTION public.move_deal_to_owner(
  _deal_id uuid,
  _to_owner_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _tenant UUID;
  _from_owner UUID;
  _user UUID;
BEGIN
  _user := auth.uid();
  _tenant := get_user_tenant_id(_user);

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant não resolvido' USING ERRCODE = 'P0401';
  END IF;

  -- Validate new owner belongs to same tenant
  IF NOT EXISTS (
    SELECT 1 FROM consultores
    WHERE id = _to_owner_id AND tenant_id = _tenant AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Consultor inválido ou inativo' USING ERRCODE = 'P0400';
  END IF;

  -- Lock row to prevent race conditions
  SELECT owner_id INTO _from_owner
  FROM deals
  WHERE id = _deal_id AND tenant_id = _tenant
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal não encontrado ou sem permissão' USING ERRCODE = 'P0404';
  END IF;

  -- Idempotency
  IF _from_owner = _to_owner_id THEN
    RETURN jsonb_build_object('status', 'noop', 'deal_id', _deal_id);
  END IF;

  -- Update deal (trigger syncs projection automatically)
  UPDATE deals
  SET owner_id = _to_owner_id, updated_at = now()
  WHERE id = _deal_id AND tenant_id = _tenant;

  RETURN jsonb_build_object(
    'status', 'moved',
    'deal_id', _deal_id,
    'from_owner', _from_owner,
    'to_owner', _to_owner_id
  );
END;
$function$;

-- ─── 3. Proteção contra deleção de stage com deals vinculados ───
CREATE OR REPLACE FUNCTION public.guard_stage_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _count
  FROM deals
  WHERE stage_id = OLD.id AND tenant_id = OLD.tenant_id;

  IF _count > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir a etapa "%": existem % deal(s) vinculado(s). Mova-os antes.',
      OLD.name, _count
      USING ERRCODE = 'P0409';
  END IF;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_guard_stage_delete
  BEFORE DELETE ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION guard_stage_delete();

-- ─── 4. Propagação de rename de stage → projection ───
CREATE OR REPLACE FUNCTION public.sync_stage_rename_to_projection()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name 
     OR NEW.position IS DISTINCT FROM OLD.position
     OR NEW.probability IS DISTINCT FROM OLD.probability THEN
    UPDATE deal_kanban_projection
    SET stage_name = NEW.name,
        stage_position = NEW.position,
        stage_probability = NEW.probability,
        updated_at = now()
    WHERE stage_id = NEW.id AND tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_sync_stage_rename
  AFTER UPDATE ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION sync_stage_rename_to_projection();

-- ─── 5. Batch reorder RPC (elimina N+1 do frontend) ───
CREATE OR REPLACE FUNCTION public.reorder_pipeline_stages(
  _pipeline_id uuid,
  _ordered_ids uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _tenant UUID;
  i INTEGER;
BEGIN
  _tenant := get_user_tenant_id();
  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant não resolvido' USING ERRCODE = 'P0401';
  END IF;

  -- Validate all stages belong to this pipeline and tenant
  IF EXISTS (
    SELECT 1 FROM unnest(_ordered_ids) AS sid
    WHERE NOT EXISTS (
      SELECT 1 FROM pipeline_stages
      WHERE id = sid AND pipeline_id = _pipeline_id AND tenant_id = _tenant
    )
  ) THEN
    RAISE EXCEPTION 'IDs de stages inválidos para este pipeline' USING ERRCODE = 'P0400';
  END IF;

  -- Batch update positions
  FOR i IN 1..array_length(_ordered_ids, 1) LOOP
    UPDATE pipeline_stages
    SET position = i - 1
    WHERE id = _ordered_ids[i] AND tenant_id = _tenant;
  END LOOP;
END;
$function$;
