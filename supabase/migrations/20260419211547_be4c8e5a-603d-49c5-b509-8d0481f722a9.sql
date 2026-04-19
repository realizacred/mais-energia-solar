-- Marca jobs SolarMarket "running" antigos (>10 min sem atualização) como error,
-- evitando que travem permanentemente o botão "Importar tudo".
UPDATE public.solarmarket_import_jobs
SET status = 'error',
    error_message = COALESCE(error_message, 'Job interrompido (timeout/shutdown da edge function).'),
    finished_at = COALESCE(finished_at, now())
WHERE status = 'running'
  AND COALESCE(started_at, created_at) < now() - interval '10 minutes';