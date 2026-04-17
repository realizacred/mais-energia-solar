-- Adiciona chave canônica sm_client_id em clientes para idempotência da migração SolarMarket
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS sm_client_id bigint;

-- Índice único parcial por (tenant_id, sm_client_id) — só aplica quando sm_client_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS clientes_tenant_sm_client_id_unique
  ON public.clientes (tenant_id, sm_client_id)
  WHERE sm_client_id IS NOT NULL;

-- Índice de lookup
CREATE INDEX IF NOT EXISTS clientes_sm_client_id_idx
  ON public.clientes (sm_client_id)
  WHERE sm_client_id IS NOT NULL;