
CREATE TABLE public.nav_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nav_key TEXT NOT NULL,
  label_override TEXT,
  group_override TEXT,
  order_override INTEGER,
  visible_override BOOLEAN NOT NULL DEFAULT true,
  role_filter TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint via expression index
CREATE UNIQUE INDEX uq_nav_overrides_tenant_key_role
  ON nav_overrides(tenant_id, nav_key, COALESCE(role_filter, '__default__'));

CREATE INDEX idx_nav_overrides_tenant ON nav_overrides(tenant_id);

ALTER TABLE public.nav_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nav_overrides_select" ON public.nav_overrides
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "nav_overrides_insert" ON public.nav_overrides
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "nav_overrides_update" ON public.nav_overrides
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "nav_overrides_delete" ON public.nav_overrides
  FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE TRIGGER update_nav_overrides_updated_at
  BEFORE UPDATE ON public.nav_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_nav_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.nav_overrides
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
