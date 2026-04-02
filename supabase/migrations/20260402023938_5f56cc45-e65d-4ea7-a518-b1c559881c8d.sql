ALTER TABLE solar_market_proposals ADD COLUMN IF NOT EXISTS migrado_em timestamptz DEFAULT NULL;
ALTER TABLE solar_market_projects ADD COLUMN IF NOT EXISTS migrado_em timestamptz DEFAULT NULL;