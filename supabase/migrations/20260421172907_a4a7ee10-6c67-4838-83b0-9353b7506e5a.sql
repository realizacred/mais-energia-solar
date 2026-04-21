-- Fase 1.5: Severidade semântica em logs de importação SolarMarket
-- Distinguir error real de ausência válida de dado filho (warning/info).

ALTER TABLE public.solarmarket_import_logs
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';

-- Constraint suave: só aceitar valores conhecidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solarmarket_import_logs_severity_check'
  ) THEN
    ALTER TABLE public.solarmarket_import_logs
      ADD CONSTRAINT solarmarket_import_logs_severity_check
      CHECK (severity IN ('error','warning','info'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sm_import_logs_severity
  ON public.solarmarket_import_logs (job_id, severity);

-- Contador segregado de warnings no job
ALTER TABLE public.solarmarket_import_jobs
  ADD COLUMN IF NOT EXISTS total_warnings INTEGER NOT NULL DEFAULT 0;

-- Backfill de severidade nos logs legados:
-- 1) Tudo que estava como action='error' assume 'error' por padrão
UPDATE public.solarmarket_import_logs
SET severity = 'error'
WHERE action = 'error' AND severity = 'info';

-- 2) Reclassificar ausências válidas (projeto sem proposta) como warning
-- Heurística: error_message mencionando "Projeto X: HTTP 404" no contexto de proposta
UPDATE public.solarmarket_import_logs
SET
  severity = 'warning',
  error_code = 'PROJECT_WITHOUT_PROPOSALS',
  error_origin = 'source_data'
WHERE entity_type = 'proposta'
  AND error_message ~* 'projeto.*HTTP\s*404|HTTP\s*404'
  AND (error_code IS NULL OR error_code IN ('SOURCE_NOT_FOUND_404','UNKNOWN'));

-- 3) Reclassificar 404 que NÃO são de propostas (raros) — mantém info se for skip benigno
UPDATE public.solarmarket_import_logs
SET severity = 'warning'
WHERE error_code = 'SOURCE_NOT_FOUND_404' AND severity = 'error';

-- 4) Recalcular total_warnings e total_errors dos jobs com base nos logs
UPDATE public.solarmarket_import_jobs j
SET
  total_warnings = COALESCE(w.cnt, 0),
  total_errors = COALESCE(e.cnt, 0)
FROM (
  SELECT job_id, COUNT(*)::int AS cnt
  FROM public.solarmarket_import_logs
  WHERE severity = 'warning'
  GROUP BY job_id
) w
FULL OUTER JOIN (
  SELECT job_id, COUNT(*)::int AS cnt
  FROM public.solarmarket_import_logs
  WHERE severity = 'error'
  GROUP BY job_id
) e ON e.job_id = w.job_id
WHERE j.id = COALESCE(w.job_id, e.job_id);

COMMENT ON COLUMN public.solarmarket_import_logs.severity IS
  'Severidade semântica: error (falha real), warning (ausência válida/operacional), info (skip/yield/end)';
COMMENT ON COLUMN public.solarmarket_import_jobs.total_warnings IS
  'Total de avisos operacionais (ex: projetos sem proposta) — não conta como erro';