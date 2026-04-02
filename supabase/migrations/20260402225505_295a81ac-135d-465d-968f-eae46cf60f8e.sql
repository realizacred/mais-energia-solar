ALTER TABLE solar_market_proposals
  ADD COLUMN IF NOT EXISTS modulo_fabricante text,
  ADD COLUMN IF NOT EXISTS modulo_potencia_w numeric,
  ADD COLUMN IF NOT EXISTS inversor_fabricante text,
  ADD COLUMN IF NOT EXISTS inversor_potencia_w numeric,
  ADD COLUMN IF NOT EXISTS subgrupo_tarifario text,
  ADD COLUMN IF NOT EXISTS regra_compensacao text,
  ADD COLUMN IF NOT EXISTS inclinacao numeric,
  ADD COLUMN IF NOT EXISTS desvio_azimutal numeric,
  ADD COLUMN IF NOT EXISTS fator_geracao numeric,
  ADD COLUMN IF NOT EXISTS taxa_desempenho numeric,
  ADD COLUMN IF NOT EXISTS area_util numeric,
  ADD COLUMN IF NOT EXISTS tensao_rede text,
  ADD COLUMN IF NOT EXISTS topologia text;