-- Status do envio de WhatsApp de boas-vindas
-- Valores: 'pending' (aguardando), 'sent' (enviado), 'failed' (falhou), 'skipped' (desativado/pulado)
ALTER TABLE public.leads ADD COLUMN wa_welcome_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.leads ADD COLUMN wa_welcome_error text;

COMMENT ON COLUMN public.leads.wa_welcome_status IS 'Status do envio da msg WA: pending, sent, failed, skipped';
COMMENT ON COLUMN public.leads.wa_welcome_error IS 'Mensagem de erro quando wa_welcome_status = failed';