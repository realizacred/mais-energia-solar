-- Adicionar colunas para registro de tempo e fotos nos serviços agendados
ALTER TABLE public.servicos_agendados
ADD COLUMN IF NOT EXISTS data_hora_inicio timestamp with time zone,
ADD COLUMN IF NOT EXISTS data_hora_fim timestamp with time zone,
ADD COLUMN IF NOT EXISTS fotos_urls text[] DEFAULT '{}'::text[];

-- Comentários para documentação
COMMENT ON COLUMN public.servicos_agendados.data_hora_inicio IS 'Data/hora real de início do serviço pelo instalador';
COMMENT ON COLUMN public.servicos_agendados.data_hora_fim IS 'Data/hora real de conclusão do serviço';
COMMENT ON COLUMN public.servicos_agendados.fotos_urls IS 'URLs das fotos tiradas durante o serviço';