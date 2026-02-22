-- First, clean up duplicate telefone_normalized by keeping only the most recent client per tenant+phone
-- Set telefone_normalized = NULL on older duplicates (preserves the rows, just removes the constraint conflict)
WITH ranked AS (
  SELECT id, tenant_id, telefone_normalized,
    ROW_NUMBER() OVER (PARTITION BY tenant_id, telefone_normalized ORDER BY created_at DESC) AS rn
  FROM public.clientes
  WHERE telefone_normalized IS NOT NULL AND telefone_normalized <> ''
)
UPDATE public.clientes c
SET telefone_normalized = NULL
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_tenant_telefone
ON public.clientes (tenant_id, telefone_normalized)
WHERE telefone_normalized IS NOT NULL AND telefone_normalized <> '';