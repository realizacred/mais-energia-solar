-- Adicionar campos para vídeo e layout de módulos na tabela servicos_agendados
ALTER TABLE public.servicos_agendados 
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS audio_url text,
ADD COLUMN IF NOT EXISTS layout_modulos jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.servicos_agendados.video_url IS 'URL do vídeo gravado/anexado pelo instalador';
COMMENT ON COLUMN public.servicos_agendados.audio_url IS 'URL do áudio gravado/anexado pelo instalador';
COMMENT ON COLUMN public.servicos_agendados.layout_modulos IS 'JSON contendo o layout dos módulos fotovoltaicos desenhado pelo instalador';