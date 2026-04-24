-- Índice para acelerar a busca paginada em sm_propostas_raw durante a migração SM.
-- A query "SELECT id, external_id, payload FROM sm_propostas_raw WHERE tenant_id=? ORDER BY imported_at ASC RANGE (0, N)"
-- estava forçando seq scan + sort do payload JSONB inteiro (47MB), causando
-- "canceling statement due to statement timeout" no sm-promote (Step 3).
CREATE INDEX IF NOT EXISTS idx_sm_propostas_raw_tenant_imported_at
  ON public.sm_propostas_raw (tenant_id, imported_at ASC);

-- Mesma otimização para os outros stagings consumidos pelo sm-promote em ordem cronológica.
CREATE INDEX IF NOT EXISTS idx_sm_clientes_raw_tenant_imported_at
  ON public.sm_clientes_raw (tenant_id, imported_at ASC);

CREATE INDEX IF NOT EXISTS idx_sm_projetos_raw_tenant_imported_at
  ON public.sm_projetos_raw (tenant_id, imported_at ASC);