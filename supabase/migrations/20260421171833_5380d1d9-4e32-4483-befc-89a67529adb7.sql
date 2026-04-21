-- Fase 1: Taxonomia estável de erros de importação SolarMarket
-- Adiciona error_code e error_origin para permitir agrupamento e diagnóstico

ALTER TABLE public.solarmarket_import_logs
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_origin TEXT;

-- Índices para consultas de auditoria por job + código
CREATE INDEX IF NOT EXISTS idx_sm_import_logs_job_code
  ON public.solarmarket_import_logs (job_id, error_code)
  WHERE error_message IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sm_import_logs_origin
  ON public.solarmarket_import_logs (error_origin)
  WHERE error_origin IS NOT NULL;

-- Backfill heurístico para os 231 erros legados — classificação estável
-- baseada em padrões da error_message gravada pela edge function.
UPDATE public.solarmarket_import_logs
SET
  error_code = CASE
    WHEN error_message ~* '404|not found|não encontrad' THEN 'SOURCE_NOT_FOUND_404'
    WHEN error_message ~* '401|403|unauthorized|forbidden|invalid.*token|auth' THEN 'AUTH_FAILED'
    WHEN error_message ~* '429|rate.?limit|too many' THEN 'RATE_LIMITED'
    WHEN error_message ~* '5\d{2}|internal server|bad gateway|service unavailable' THEN 'UPSTREAM_5XX'
    WHEN error_message ~* 'timeout|timed out|abort' THEN 'TIMEOUT'
    WHEN error_message ~* 'endpoint|discovery|no proposal endpoint|fallback' THEN 'ENDPOINT_DISCOVERY_FAILED'
    WHEN error_message ~* 'invalid|missing|null|required|parse|json' THEN 'SOURCE_DATA_INVALID'
    ELSE 'UNKNOWN'
  END,
  error_origin = CASE
    WHEN error_message ~* '404|not found|não encontrad' THEN 'api'
    WHEN error_message ~* '401|403|429|5\d{2}|timeout|endpoint' THEN 'api'
    WHEN error_message ~* 'invalid|missing|null|required|parse' THEN 'source_data'
    ELSE 'unknown'
  END
WHERE error_message IS NOT NULL
  AND error_code IS NULL;

COMMENT ON COLUMN public.solarmarket_import_logs.error_code IS
  'Código estável do erro (taxonomia Fase 1): SOURCE_NOT_FOUND_404, AUTH_FAILED, RATE_LIMITED, UPSTREAM_5XX, TIMEOUT, ENDPOINT_DISCOVERY_FAILED, SOURCE_DATA_INVALID, UNKNOWN';
COMMENT ON COLUMN public.solarmarket_import_logs.error_origin IS
  'Origem do erro: api | source_data | system | unknown';