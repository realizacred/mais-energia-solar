ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS cenario text,
  ADD COLUMN IF NOT EXISTS nivel_urgencia text,
  ADD COLUMN IF NOT EXISTS precisa_revisao_humana boolean,
  ADD COLUMN IF NOT EXISTS tempo_resposta_ms integer,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_source_created
  ON public.ai_usage_logs (source, created_at DESC)
  WHERE source IS NOT NULL;