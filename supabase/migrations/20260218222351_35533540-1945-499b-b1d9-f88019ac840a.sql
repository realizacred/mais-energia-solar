
-- Add installation address fields to projetos table
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS cep_instalacao text,
  ADD COLUMN IF NOT EXISTS rua_instalacao text,
  ADD COLUMN IF NOT EXISTS numero_instalacao text,
  ADD COLUMN IF NOT EXISTS bairro_instalacao text,
  ADD COLUMN IF NOT EXISTS cidade_instalacao text,
  ADD COLUMN IF NOT EXISTS uf_instalacao text,
  ADD COLUMN IF NOT EXISTS complemento_instalacao text,
  ADD COLUMN IF NOT EXISTS lat_instalacao numeric,
  ADD COLUMN IF NOT EXISTS lon_instalacao numeric;

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_projetos_uf_cidade_instalacao ON public.projetos (uf_instalacao, cidade_instalacao) WHERE uf_instalacao IS NOT NULL;
