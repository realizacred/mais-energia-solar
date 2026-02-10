
-- ===================================================
-- FASE B1: Backfill leads.vendedor_id (unique matches only)
-- ===================================================
UPDATE leads l
SET vendedor_id = v.id
FROM vendedores v
WHERE l.vendedor_id IS NULL
  AND l.vendedor IS NOT NULL
  AND LOWER(TRIM(l.vendedor)) = LOWER(TRIM(v.nome))
  AND l.tenant_id = v.tenant_id
  AND NOT EXISTS (
    SELECT 1 FROM vendedores v2 
    WHERE LOWER(TRIM(l.vendedor)) = LOWER(TRIM(v2.nome)) 
      AND l.tenant_id = v2.tenant_id 
      AND v2.id != v.id
  );

-- ===================================================
-- FASE B2: Add vendedor_id to orcamentos table
-- ===================================================
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor_id ON public.orcamentos(vendedor_id);

-- Backfill orcamentos.vendedor_id from leads.vendedor_id
UPDATE orcamentos o
SET vendedor_id = l.vendedor_id
FROM leads l
WHERE o.lead_id = l.id
  AND l.vendedor_id IS NOT NULL
  AND o.vendedor_id IS NULL;

-- Also try direct match for orcamentos.vendedor text field
UPDATE orcamentos o
SET vendedor_id = v.id
FROM vendedores v
WHERE o.vendedor_id IS NULL
  AND o.vendedor IS NOT NULL
  AND LOWER(TRIM(o.vendedor)) = LOWER(TRIM(v.nome))
  AND o.tenant_id = v.tenant_id
  AND NOT EXISTS (
    SELECT 1 FROM vendedores v2 
    WHERE LOWER(TRIM(o.vendedor)) = LOWER(TRIM(v2.nome)) 
      AND o.tenant_id = v2.tenant_id 
      AND v2.id != v.id
  );
