-- Idempotency flag para mensagem de boas-vindas WA no formulário público
ALTER TABLE public.leads ADD COLUMN wa_welcome_sent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.wa_welcome_sent IS 'Flag de idempotência: true se a mensagem de boas-vindas WA já foi enviada para este lead';
