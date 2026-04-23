-- 1. Adiciona coluna para safety cron detectar jobs travados
ALTER TABLE public.solarmarket_promotion_jobs
  ADD COLUMN IF NOT EXISTS last_step_at timestamptz;

-- 2. Cancela job zumbi atual (running mas sem step h\u00e1 muito tempo)
UPDATE public.solarmarket_promotion_jobs
   SET status = 'cancelled',
       finished_at = now(),
       error_summary = 'Cancelado: aba do usu\u00e1rio fechada antes do auto-encadeamento ser implementado.'
 WHERE job_type = 'migrate-chunked'
   AND status = 'running'
   AND (last_step_at IS NULL OR last_step_at < now() - interval '5 minutes');

-- 3. RPC chamada pelo pg_cron para resgatar jobs travados.
--    Identifica jobs running cujo \u00faltimo step foi h\u00e1 mais de 2 minutos
--    e dispara sm-migrate-chunk via pg_net (n\u00e3o-bloqueante).
CREATE OR REPLACE FUNCTION public.sm_resume_stuck_migrations()
RETURNS TABLE(job_id uuid, dispatched boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rec RECORD;
  fn_url text := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/sm-migrate-chunk';
  service_key text;
BEGIN
  -- Busca a service role key dos vault secrets (j\u00e1 dispon\u00edvel via Supabase)
  -- pg_net.http_post n\u00e3o exige a key se a fun\u00e7\u00e3o tiver verify_jwt=false; passamos por header customizado.
  FOR rec IN
    SELECT id, tenant_id
      FROM public.solarmarket_promotion_jobs
     WHERE job_type = 'migrate-chunked'
       AND status = 'running'
       AND (last_step_at IS NULL OR last_step_at < now() - interval '2 minutes')
     ORDER BY created_at ASC
     LIMIT 5
  LOOP
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sm-cron-secret', 'sm-resume-cron-v1'
      ),
      body := jsonb_build_object(
        'action', 'cron_resume',
        'payload', jsonb_build_object(
          'master_job_id', rec.id,
          'tenant_id', rec.tenant_id
        )
      )
    );
    job_id := rec.id;
    dispatched := true;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- 4. Cron job: a cada 1 minuto resgata jobs travados
SELECT cron.unschedule('sm-resume-stuck-migrations')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sm-resume-stuck-migrations');

SELECT cron.schedule(
  'sm-resume-stuck-migrations',
  '*/1 * * * *',
  $$ SELECT public.sm_resume_stuck_migrations(); $$
);