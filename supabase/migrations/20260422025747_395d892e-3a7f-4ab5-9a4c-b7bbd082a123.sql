-- Função wrapper que invoca a edge function sm-import-project-funnels
-- via net.http_post. Para-se sozinha quando não há mais projetos pendentes
-- para o tenant alvo.
CREATE OR REPLACE FUNCTION public.trigger_sm_import_project_funnels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_pending int;
BEGIN
  SELECT COUNT(*) INTO v_pending
  FROM sm_projetos_raw p
  WHERE p.tenant_id = v_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM sm_projeto_funis_raw pf
      WHERE pf.tenant_id = p.tenant_id
        AND pf.sm_project_id = p.external_id::bigint
    );

  IF v_pending = 0 THEN
    PERFORM cron.unschedule('sm-import-project-funnels-job');
    RAISE NOTICE 'Importação completa. Job removido.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/sm-import-project-funnels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw'
    ),
    body := jsonb_build_object(
      'tenantId', v_tenant_id::text,
      'batchSize', 100,
      'throttleMs', 500
    )
  );
END;
$$;

-- Garante que job antigo (se existir) seja removido antes de re-agendar
DO $$
BEGIN
  PERFORM cron.unschedule('sm-import-project-funnels-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agendamento: a cada minuto
SELECT cron.schedule(
  'sm-import-project-funnels-job',
  '* * * * *',
  $$SELECT public.trigger_sm_import_project_funnels()$$
);