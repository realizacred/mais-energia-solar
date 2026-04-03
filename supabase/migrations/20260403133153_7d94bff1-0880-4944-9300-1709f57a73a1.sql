-- Remove duplicate consultores (keep first by created_at per tenant+nome)
DELETE FROM consultores c1
WHERE EXISTS (
  SELECT 1 FROM consultores c2
  WHERE c2.tenant_id = c1.tenant_id
    AND c2.nome = c1.nome
    AND c2.created_at < c1.created_at
);

-- Also handle same created_at by keeping lower id::text
DELETE FROM consultores c1
WHERE EXISTS (
  SELECT 1 FROM consultores c2
  WHERE c2.tenant_id = c1.tenant_id
    AND c2.nome = c1.nome
    AND c2.created_at = c1.created_at
    AND c2.id::text < c1.id::text
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE consultores ADD CONSTRAINT uq_consultores_tenant_nome UNIQUE (tenant_id, nome);