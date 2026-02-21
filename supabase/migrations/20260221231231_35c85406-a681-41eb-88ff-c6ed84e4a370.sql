-- Add sombreamento configuration to tenant_premises
-- Stores shading loss percentages per topology per intensity level
ALTER TABLE public.tenant_premises
ADD COLUMN IF NOT EXISTS sombreamento_config JSONB NOT NULL DEFAULT '{
  "pouco": { "tradicional": 12, "microinversor": 6, "otimizador": 6 },
  "medio": { "tradicional": 25, "microinversor": 12, "otimizador": 12 },
  "alto": { "tradicional": 37, "microinversor": 18, "otimizador": 18 }
}'::jsonb;

COMMENT ON COLUMN public.tenant_premises.sombreamento_config IS 'Shading loss % per topology per level (pouco/medio/alto). Applied as reduction to taxa_desempenho.';