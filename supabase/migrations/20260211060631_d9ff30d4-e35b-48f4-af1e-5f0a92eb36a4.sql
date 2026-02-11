
-- ============================================================
-- Junction table: wa_instance_vendedores (M:N)
-- Source of truth for which vendedores are linked to an instance
-- ============================================================
CREATE TABLE public.wa_instance_vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, vendedor_id)
);

-- Enable RLS
ALTER TABLE public.wa_instance_vendedores ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "rls_wa_instance_vendedores_admin"
ON public.wa_instance_vendedores FOR ALL
USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Vendors can see their own links
CREATE POLICY "rls_wa_instance_vendedores_select_vendor"
ON public.wa_instance_vendedores FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM vendedores v
    WHERE v.id = wa_instance_vendedores.vendedor_id
      AND v.user_id = auth.uid()
      AND v.ativo = true
  )
);

-- Service role
CREATE POLICY "rls_wa_instance_vendedores_service"
ON public.wa_instance_vendedores FOR ALL
USING (true)
WITH CHECK (tenant_id IS NOT NULL);

-- Index for fast lookup
CREATE INDEX idx_wa_instance_vendedores_instance ON public.wa_instance_vendedores(instance_id);
CREATE INDEX idx_wa_instance_vendedores_vendedor ON public.wa_instance_vendedores(vendedor_id);

-- ============================================================
-- Migrate existing data: copy vendedor_id to junction table
-- ============================================================
INSERT INTO public.wa_instance_vendedores (instance_id, vendedor_id, tenant_id)
SELECT id, vendedor_id, tenant_id
FROM public.wa_instances
WHERE vendedor_id IS NOT NULL AND tenant_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- Update RLS on wa_instances to use junction table
-- ============================================================
DROP POLICY IF EXISTS "rls_wa_instances_select_vendor" ON public.wa_instances;

CREATE POLICY "rls_wa_instances_select_vendor"
ON public.wa_instances FOR SELECT
USING (
  tenant_id = get_user_tenant_id()
  AND (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM wa_instance_vendedores wiv
      JOIN vendedores v ON v.id = wiv.vendedor_id
      WHERE wiv.instance_id = wa_instances.id
        AND v.user_id = auth.uid()
        AND v.ativo = true
    )
  )
);

-- ============================================================
-- Update can_access_wa_conversation to use junction table
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_wa_conversation(_conversation_id uuid, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM wa_conversations wc
    LEFT JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = _conversation_id
      AND wc.tenant_id = get_user_tenant_id(_user_id)
      AND (
        wc.assigned_to = _user_id
        OR wi.owner_user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM wa_instance_vendedores wiv
          JOIN vendedores v ON v.id = wiv.vendedor_id
          WHERE wiv.instance_id = wi.id
            AND v.user_id = _user_id
            AND v.ativo = true
        )
      )
  )
$$;

-- Add comment
COMMENT ON TABLE public.wa_instance_vendedores IS 'Junction table M:N between wa_instances and vendedores. Source of truth for instance ownership.';
