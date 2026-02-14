
-- ═══════════════════════════════════════════════════════
-- FASE 1: MOTOR DE FUNIL (KANBAN ENGINE)
-- ═══════════════════════════════════════════════════════

-- 1. PIPELINES
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  parent_pipeline_id UUID REFERENCES pipelines(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_pipeline_tenant_name_version 
    UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_pipelines_tenant_active 
  ON pipelines(tenant_id) WHERE is_active = true;

-- 2. PIPELINE STAGES
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  is_won BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_stage_probability CHECK (probability >= 0 AND probability <= 100),
  CONSTRAINT chk_won_implies_closed CHECK ((is_won = false) OR (is_closed = true))
);

CREATE INDEX idx_stages_pipeline_position 
  ON pipeline_stages(pipeline_id, position);

CREATE INDEX idx_stages_tenant 
  ON pipeline_stages(tenant_id);

-- 3. DEALS (AGGREGATE ROOT)
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  customer_id UUID REFERENCES clientes(id),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  expected_close_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_deal_status CHECK (status IN ('open', 'won', 'lost', 'archived'))
);

CREATE INDEX idx_deals_pipeline_stage 
  ON deals(tenant_id, pipeline_id, stage_id) 
  WHERE status = 'open';

CREATE INDEX idx_deals_owner 
  ON deals(tenant_id, owner_id) 
  WHERE status = 'open';

CREATE INDEX idx_deals_forecast 
  ON deals(tenant_id, pipeline_id, expected_close_date) 
  WHERE status = 'open';

-- 4. DEAL STAGE HISTORY (AUDIT — APPEND-ONLY)
CREATE TABLE public.deal_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  from_stage_id UUID REFERENCES pipeline_stages(id),
  to_stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  moved_by UUID,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_deal_history_deal 
  ON deal_stage_history(deal_id, moved_at DESC);

CREATE INDEX idx_deal_history_stage 
  ON deal_stage_history(tenant_id, to_stage_id, moved_at);

-- Imutabilidade: bloquear UPDATE e DELETE
CREATE TRIGGER prevent_deal_history_update
  BEFORE UPDATE ON deal_stage_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

CREATE TRIGGER prevent_deal_history_delete
  BEFORE DELETE ON deal_stage_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

-- 5. DEAL KANBAN PROJECTION (READ MODEL)
CREATE TABLE public.deal_kanban_projection (
  deal_id UUID NOT NULL PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  pipeline_id UUID NOT NULL,
  stage_id UUID NOT NULL,
  stage_name TEXT NOT NULL,
  stage_position INT NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  deal_title TEXT NOT NULL DEFAULT '',
  deal_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  deal_status TEXT NOT NULL DEFAULT 'open',
  stage_probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_stage_change TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_proj_pipeline 
  ON deal_kanban_projection(tenant_id, pipeline_id, stage_position)
  WHERE deal_status = 'open';

CREATE INDEX idx_kanban_proj_owner 
  ON deal_kanban_projection(tenant_id, owner_id)
  WHERE deal_status = 'open';

-- ═══════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_kanban_projection ENABLE ROW LEVEL SECURITY;

-- Pipelines
CREATE POLICY "pipelines_tenant_isolation" ON pipelines
  FOR ALL USING (tenant_id = get_user_tenant_id() AND tenant_is_active())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Pipeline Stages
CREATE POLICY "stages_tenant_isolation" ON pipeline_stages
  FOR ALL USING (tenant_id = get_user_tenant_id() AND tenant_is_active())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Deals
CREATE POLICY "deals_tenant_isolation" ON deals
  FOR ALL USING (tenant_id = get_user_tenant_id() AND tenant_is_active())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Deal Stage History (SELECT + INSERT only)
CREATE POLICY "history_select" ON deal_stage_history
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_is_active());

CREATE POLICY "history_insert" ON deal_stage_history
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

-- Kanban Projection (SELECT only — managed by triggers)
CREATE POLICY "kanban_proj_select" ON deal_kanban_projection
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_is_active());

-- ═══════════════════════════════════════════════════════
-- SYNC TRIGGER: deals → deal_kanban_projection
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_deal_kanban_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO deal_kanban_projection (
    deal_id, tenant_id, pipeline_id, stage_id, stage_name,
    stage_position, owner_id, owner_name, customer_name,
    deal_title, deal_value, deal_status, stage_probability,
    last_stage_change, updated_at
  )
  SELECT
    NEW.id, NEW.tenant_id, NEW.pipeline_id, NEW.stage_id,
    ps.name, ps.position, NEW.owner_id,
    COALESCE(c.nome, ''), COALESCE(cl.nome, ''),
    NEW.title, NEW.value, NEW.status, ps.probability,
    now(), now()
  FROM pipeline_stages ps
  LEFT JOIN consultores c ON c.id = NEW.owner_id
  LEFT JOIN clientes cl ON cl.id = NEW.customer_id
  WHERE ps.id = NEW.stage_id
  ON CONFLICT (deal_id) DO UPDATE SET
    stage_id = EXCLUDED.stage_id,
    stage_name = EXCLUDED.stage_name,
    stage_position = EXCLUDED.stage_position,
    owner_id = EXCLUDED.owner_id,
    owner_name = EXCLUDED.owner_name,
    customer_name = EXCLUDED.customer_name,
    deal_title = EXCLUDED.deal_title,
    deal_value = EXCLUDED.deal_value,
    deal_status = EXCLUDED.deal_status,
    stage_probability = EXCLUDED.stage_probability,
    last_stage_change = CASE 
      WHEN deal_kanban_projection.stage_id != EXCLUDED.stage_id 
      THEN now() ELSE deal_kanban_projection.last_stage_change 
    END,
    updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_deal_kanban
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION sync_deal_kanban_projection();

-- ═══════════════════════════════════════════════════════
-- RPC: MOVE DEAL (ATOMIC + IDEMPOTENT + AUDITED)
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION move_deal_to_stage(
  _deal_id UUID,
  _to_stage_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _tenant UUID;
  _from_stage UUID;
  _user UUID;
BEGIN
  _user := auth.uid();
  _tenant := get_user_tenant_id(_user);

  IF _tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant não resolvido' USING ERRCODE = 'P0401';
  END IF;

  -- Lock row to prevent race conditions
  SELECT stage_id INTO _from_stage
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
$$;

-- ═══════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
