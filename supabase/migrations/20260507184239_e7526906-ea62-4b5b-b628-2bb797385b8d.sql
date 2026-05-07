-- Telefone como heurística, não identidade
DROP INDEX IF EXISTS public.uq_clientes_tenant_telefone;

-- Garante índice de busca (não-unique) por (tenant_id, telefone_normalized)
CREATE INDEX IF NOT EXISTS idx_clientes_tenant_telefone_normalized
  ON public.clientes (tenant_id, telefone_normalized)
  WHERE telefone_normalized IS NOT NULL AND telefone_normalized <> '';