
-- =============================================================
-- PRICING POLICY ENGINE — Enterprise Schema
-- =============================================================

-- ─── Enum: pricing policy version status ───
CREATE TYPE public.pricing_policy_status AS ENUM ('draft', 'active', 'archived');

-- ─── Enum: cost component calculation strategy ───
CREATE TYPE public.cost_calc_strategy AS ENUM (
  'fixed_amount',
  'cost_per_kwp',
  'cost_per_kva',
  'cost_per_km',
  'percentage_of_cost',
  'composite',
  'rule_based'
);

-- ─── Enum: pricing method type ───
CREATE TYPE public.pricing_method_type AS ENUM ('margin_on_sale', 'margin_on_cost');

-- ─── Enum: commission plan type ───
CREATE TYPE public.commission_plan_type AS ENUM ('fixed', 'percentage', 'dynamic');

-- =============================================================
-- 1. PRICING POLICIES (top-level container)
-- =============================================================
CREATE TABLE public.pricing_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_policies_tenant ON public.pricing_policies(tenant_id);
ALTER TABLE public.pricing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.pricing_policies
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.pricing_policies
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.pricing_policies
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.pricing_policies
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_pricing_policies_updated_at
  BEFORE UPDATE ON public.pricing_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 2. PRICING POLICY VERSIONS (immutable snapshots)
-- =============================================================
CREATE TABLE public.pricing_policy_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.pricing_policies(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  status public.pricing_policy_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, version_number)
);

CREATE INDEX idx_ppv_tenant ON public.pricing_policy_versions(tenant_id);
CREATE INDEX idx_ppv_policy_status ON public.pricing_policy_versions(policy_id, status);
ALTER TABLE public.pricing_policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.pricing_policy_versions
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.pricing_policy_versions
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.pricing_policy_versions
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.pricing_policy_versions
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_ppv_updated_at
  BEFORE UPDATE ON public.pricing_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 3. PRICING COST COMPONENTS (strategy-driven)
-- =============================================================
CREATE TABLE public.pricing_cost_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.pricing_policy_versions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  calculation_strategy public.cost_calc_strategy NOT NULL DEFAULT 'fixed_amount',
  parameters JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcc_version ON public.pricing_cost_components(version_id);
CREATE INDEX idx_pcc_tenant ON public.pricing_cost_components(tenant_id);
ALTER TABLE public.pricing_cost_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.pricing_cost_components
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.pricing_cost_components
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.pricing_cost_components
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.pricing_cost_components
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_pcc_updated_at
  BEFORE UPDATE ON public.pricing_cost_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 4. PRICING METHOD (per version)
-- =============================================================
CREATE TABLE public.pricing_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.pricing_policy_versions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  method_type public.pricing_method_type NOT NULL DEFAULT 'margin_on_cost',
  default_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 25.00,
  default_tax_percent NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  kit_margin_override_percent NUMERIC(6,2),
  kit_tax_override_percent NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(version_id)
);

CREATE INDEX idx_pm_tenant ON public.pricing_methods(tenant_id);
ALTER TABLE public.pricing_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.pricing_methods
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.pricing_methods
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.pricing_methods
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.pricing_methods
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_pm_updated_at
  BEFORE UPDATE ON public.pricing_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 5. MARGIN PLANS (reusable governance)
-- =============================================================
CREATE TABLE public.margin_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  min_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 10.00,
  max_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 50.00,
  default_margin_percent NUMERIC(6,2) NOT NULL DEFAULT 25.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_margin_plans_tenant ON public.margin_plans(tenant_id);
ALTER TABLE public.margin_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.margin_plans
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.margin_plans
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.margin_plans
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.margin_plans
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_margin_plans_updated_at
  BEFORE UPDATE ON public.margin_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 6. COMMISSION PLANS (reusable governance)
-- =============================================================
CREATE TABLE public.commission_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  commission_type public.commission_plan_type NOT NULL DEFAULT 'percentage',
  parameters JSONB NOT NULL DEFAULT '{"rate": 5}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_plans_tenant ON public.commission_plans(tenant_id);
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.commission_plans
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.commission_plans
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.commission_plans
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.commission_plans
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_commission_plans_updated_at
  BEFORE UPDATE ON public.commission_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 7. USER PRICING ASSIGNMENTS (inherit plans)
-- =============================================================
CREATE TABLE public.user_pricing_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  margin_plan_id UUID REFERENCES public.margin_plans(id) ON DELETE SET NULL,
  commission_plan_id UUID REFERENCES public.commission_plans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_upa_tenant ON public.user_pricing_assignments(tenant_id);
ALTER TABLE public.user_pricing_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.user_pricing_assignments
  FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.user_pricing_assignments
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_update" ON public.user_pricing_assignments
  FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_delete" ON public.user_pricing_assignments
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER trg_upa_updated_at
  BEFORE UPDATE ON public.user_pricing_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- TENANT_ID AUTO-RESOLUTION TRIGGERS
-- =============================================================
CREATE OR REPLACE FUNCTION public.resolve_pricing_tenant_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pricing_policies_resolve_tenant
  BEFORE INSERT ON public.pricing_policies FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_ppv_resolve_tenant
  BEFORE INSERT ON public.pricing_policy_versions FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_pcc_resolve_tenant
  BEFORE INSERT ON public.pricing_cost_components FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_pm_resolve_tenant
  BEFORE INSERT ON public.pricing_methods FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_margin_plans_resolve_tenant
  BEFORE INSERT ON public.margin_plans FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_commission_plans_resolve_tenant
  BEFORE INSERT ON public.commission_plans FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();
CREATE TRIGGER trg_upa_resolve_tenant
  BEFORE INSERT ON public.user_pricing_assignments FOR EACH ROW
  EXECUTE FUNCTION public.resolve_pricing_tenant_id();

-- =============================================================
-- IMMUTABILITY GUARD: Prevent edits on published versions
-- =============================================================
CREATE OR REPLACE FUNCTION public.guard_pricing_version_immutability()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow status transitions on published versions
  IF OLD.status IN ('active', 'archived') AND TG_OP = 'UPDATE' THEN
    -- Allow archiving an active version
    IF OLD.status = 'active' AND NEW.status = 'archived' THEN
      RETURN NEW;
    END IF;
    -- Block all other mutations on published versions
    IF NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.policy_id IS DISTINCT FROM OLD.policy_id
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'pricing_policy_versions: published versions are immutable (status=%)', OLD.status
        USING ERRCODE = 'P0403';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ppv_immutability_guard
  BEFORE UPDATE ON public.pricing_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.guard_pricing_version_immutability();

-- Guard: prevent mutation of cost components on published versions
CREATE OR REPLACE FUNCTION public.guard_cost_component_immutability()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE _status public.pricing_policy_status;
BEGIN
  SELECT status INTO _status FROM public.pricing_policy_versions
    WHERE id = COALESCE(NEW.version_id, OLD.version_id);
  IF _status IN ('active', 'archived') THEN
    RAISE EXCEPTION 'Cannot modify cost components of a published pricing version'
      USING ERRCODE = 'P0403';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_pcc_immutability_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.pricing_cost_components
  FOR EACH ROW EXECUTE FUNCTION public.guard_cost_component_immutability();

-- Guard: prevent mutation of pricing method on published versions
CREATE TRIGGER trg_pm_immutability_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.pricing_methods
  FOR EACH ROW EXECUTE FUNCTION public.guard_cost_component_immutability();
