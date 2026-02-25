
-- Add geracao_mensal column for fast dashboard/listing queries
ALTER TABLE public.proposta_versoes 
ADD COLUMN IF NOT EXISTS geracao_mensal numeric DEFAULT NULL;

COMMENT ON COLUMN public.proposta_versoes.geracao_mensal IS 'Geração mensal estimada em kWh para consultas rápidas em dashboards';
