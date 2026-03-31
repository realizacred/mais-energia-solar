-- ============================================================
-- FASE 1: Tabela de referência global municipios_ibge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.municipios_ibge (
  codigo_ibge TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  uf_sigla TEXT NOT NULL,
  uf_codigo TEXT,
  regiao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_nome_normalizado ON public.municipios_ibge (nome_normalizado);
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_uf_sigla ON public.municipios_ibge (uf_sigla);
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_nome_uf ON public.municipios_ibge (nome_normalizado, uf_sigla);

-- RLS — tabela global de referência, leitura para autenticados
ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "municipios_ibge_read_authenticated"
  ON public.municipios_ibge
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- FASE 2: Adicionar municipio_ibge_codigo nas entidades
-- ============================================================
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS municipio_ibge_codigo TEXT REFERENCES public.municipios_ibge(codigo_ibge);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS municipio_ibge_codigo TEXT REFERENCES public.municipios_ibge(codigo_ibge);

ALTER TABLE public.units_consumidoras
  ADD COLUMN IF NOT EXISTS municipio_ibge_codigo TEXT REFERENCES public.municipios_ibge(codigo_ibge);

-- Índices para FK
CREATE INDEX IF NOT EXISTS idx_clientes_municipio_ibge ON public.clientes (municipio_ibge_codigo);
CREATE INDEX IF NOT EXISTS idx_leads_municipio_ibge ON public.leads (municipio_ibge_codigo);
CREATE INDEX IF NOT EXISTS idx_units_consumidoras_municipio_ibge ON public.units_consumidoras (municipio_ibge_codigo);