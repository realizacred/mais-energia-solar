UPDATE solarmarket_import_jobs
SET status = 'cancelled',
    finished_at = now(),
    error_message = COALESCE(error_message, 'Cancelado: job órfão sem progresso há mais de 1h (RB-66). Staging já populado.'),
    updated_at = now()
WHERE id = '3b4e6de4-f79f-4613-8144-5a76ae35ee62'
  AND status = 'running';