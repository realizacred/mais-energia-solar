-- Marca como falhos os jobs de migração travados em "running" há mais de 2 minutos.
-- Causa: edge function terminou sem atualizar o status (timeout/encerramento abrupto).
UPDATE public.migration_jobs
SET
  status = 'failed',
  completed_at = now(),
  error_message = COALESCE(error_message, 'Job interrompido (timeout/edge function encerrou sem finalizar). Use "Limpar histórico" e crie um novo job.')
WHERE status = 'running'
  AND started_at < now() - interval '2 minutes';