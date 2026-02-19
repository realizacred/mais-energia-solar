
-- Table to store module-level permissions per role per tenant
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  role app_role NOT NULL,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, module_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage role permissions
CREATE POLICY "role_permissions_select" ON public.role_permissions
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "role_permissions_insert" ON public.role_permissions
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "role_permissions_update" ON public.role_permissions
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()));

CREATE POLICY "role_permissions_delete" ON public.role_permissions
FOR DELETE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
