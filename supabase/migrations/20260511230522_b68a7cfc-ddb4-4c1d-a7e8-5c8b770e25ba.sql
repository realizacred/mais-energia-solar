-- 1. Criar índice para performance nas validações de token expirado
CREATE INDEX IF NOT EXISTS idx_proposta_aceite_tokens_expires_at 
ON public.proposta_aceite_tokens(expires_at) 
WHERE expires_at IS NOT NULL;

-- 2. Criar rotina de limpeza automática de tokens expirados via pg_cron
-- Remove agendamento anterior se existir para evitar duplicação (embora a busca inicial não tenha retornado nada)
SELECT cron.unschedule('limpar-tokens-expirados') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar-tokens-expirados');

-- Agenda a limpeza para as 03:00 AM diariamente
SELECT cron.schedule(
  'limpar-tokens-expirados',
  '0 3 * * *',
  $$DELETE FROM public.proposta_aceite_tokens WHERE expires_at < now() - interval '7 days'$$
);