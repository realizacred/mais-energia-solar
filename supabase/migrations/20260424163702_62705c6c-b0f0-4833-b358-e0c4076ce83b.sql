-- 1. Cancela TODOS os jobs running de migração SolarMarket (chunked + promote-all)
UPDATE public.solarmarket_promotion_jobs
SET status = 'cancelled',
    finished_at = now(),
    updated_at = now(),
    error_summary = COALESCE(error_summary, '') || ' [cancelado manualmente para reset operacional]'
WHERE status = 'running';

-- 2. Remove o cron que reinjeta jobs parados (causa do loop fantasma)
SELECT cron.unschedule('sm-resume-stuck-migrations');