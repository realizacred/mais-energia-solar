
-- ================================================================
-- FASE 1: Evolução incremental do schema de pipelines/deals
-- ================================================================

-- 1. Criar enum para pipeline.kind
CREATE TYPE public.pipeline_kind AS ENUM ('process', 'owner_board');

-- 2. Adicionar coluna kind a pipelines (default = process para compatibilidade)
ALTER TABLE public.pipelines
  ADD COLUMN kind public.pipeline_kind NOT NULL DEFAULT 'process';

-- 3. Tornar deals.stage_id nullable (necessário para owner_board)
ALTER TABLE public.deals
  ALTER COLUMN stage_id DROP NOT NULL;

-- 4. Tornar deal_kanban_projection.stage_id nullable (reflete deals)
ALTER TABLE public.deal_kanban_projection
  ALTER COLUMN stage_id DROP NOT NULL;

-- 5. Índice para kind (performance em queries filtradas)
CREATE INDEX idx_pipelines_kind ON public.pipelines (tenant_id, kind);

-- 6. CHECK constraint: se pipeline é process, stage_id deve ser NOT NULL
-- Implementado como trigger para permitir validação cross-table
CREATE OR REPLACE FUNCTION public.validate_deal_stage_for_pipeline_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _kind public.pipeline_kind;
BEGIN
  SELECT kind INTO _kind FROM pipelines WHERE id = NEW.pipeline_id;
  
  IF _kind = 'process' AND NEW.stage_id IS NULL THEN
    RAISE EXCEPTION 'deals: stage_id é obrigatório para pipelines do tipo process'
      USING ERRCODE = 'P0422';
  END IF;
  
  IF _kind = 'owner_board' AND NEW.stage_id IS NOT NULL THEN
    -- Auto-clear stage_id for owner_board pipelines
    NEW.stage_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_deal_stage_kind
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_deal_stage_for_pipeline_kind();

-- 7. Criar tabela project_events (auditoria ampla)
CREATE TABLE public.project_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para project_events
CREATE INDEX idx_project_events_deal ON public.project_events (tenant_id, deal_id);
CREATE INDEX idx_project_events_type ON public.project_events (tenant_id, event_type, created_at DESC);

-- RLS para project_events
ALTER TABLE public.project_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view project events"
  ON public.project_events FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "System can insert project events"
  ON public.project_events FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() OR current_setting('app.audit_trigger_active', true) = 'true');

-- Imutabilidade: bloquear UPDATE e DELETE
CREATE POLICY "project_events immutable no update"
  ON public.project_events FOR UPDATE
  USING (false);

CREATE POLICY "project_events immutable no delete"
  ON public.project_events FOR DELETE
  USING (false);

-- 8. Trigger de auditoria ampla em deals
CREATE OR REPLACE FUNCTION public.audit_deal_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Set audit context
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  -- Pipeline change
  IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'pipeline_changed', OLD.pipeline_id::text, NEW.pipeline_id::text);
  END IF;

  -- Stage change
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'stage_changed', OLD.stage_id::text, NEW.stage_id::text);
  END IF;

  -- Owner/consultant change
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'consultant_changed', OLD.owner_id::text, NEW.owner_id::text);
  END IF;

  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  -- Value change
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'value_changed', OLD.value::text, NEW.value::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_deal_changes
  AFTER UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_deal_changes();

-- 9. Também auditar INSERT (criação)
CREATE OR REPLACE FUNCTION public.audit_deal_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.audit_trigger_active', 'true', true);
  
  INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
  VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'created', NULL, NEW.status);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_deal_creation
  AFTER INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_deal_creation();
