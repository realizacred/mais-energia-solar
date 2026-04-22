-- Remover cron job que rodava a cada minuto importando funis SM.
-- A importação agora é controlada pelo front (usuário decide quando rodar).
SELECT cron.unschedule('sm-import-project-funnels-job');
DROP FUNCTION IF EXISTS public.trigger_sm_import_project_funnels();