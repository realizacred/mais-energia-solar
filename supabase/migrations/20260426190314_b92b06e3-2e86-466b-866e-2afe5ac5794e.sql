UPDATE solarmarket_promotion_jobs
SET status = 'cancelled', finished_at = now()
WHERE status = 'running';

UPDATE solarmarket_import_jobs
SET status = 'cancelled', finished_at = now()
WHERE status IN ('running','pending');