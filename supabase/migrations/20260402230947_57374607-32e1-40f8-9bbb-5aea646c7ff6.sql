ALTER TABLE solar_market_proposals
  ADD COLUMN IF NOT EXISTS fluxo_caixa_acumulado jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS economia_anual_serie jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS geracao_mensal_serie jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS irradiacao_mensal_serie jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS demanda_contratada numeric,
  ADD COLUMN IF NOT EXISTS demanda_preco numeric,
  ADD COLUMN IF NOT EXISTS demanda_adicional numeric,
  ADD COLUMN IF NOT EXISTS outros_encargos numeric;