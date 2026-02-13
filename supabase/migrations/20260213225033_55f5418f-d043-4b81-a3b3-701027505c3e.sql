
-- Hardening #3: Unicidade de slug e codigo por tenant (não global)
-- Drop global unique index on slug (allows same slug across tenants)
DROP INDEX IF EXISTS consultores_slug_unique;

-- Create per-tenant unique constraints
CREATE UNIQUE INDEX consultores_tenant_slug_unique 
  ON public.consultores (tenant_id, slug) 
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX consultores_tenant_codigo_unique 
  ON public.consultores (tenant_id, codigo);
