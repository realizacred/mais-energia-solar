UPDATE public.solarmarket_promotion_jobs
SET status = 'running', finished_at = NULL, error_summary = NULL,
    last_step_at = now(), updated_at = now()
WHERE id = 'c6c0431e-a490-436b-96e1-30e08f055a15';