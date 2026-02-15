-- Add auto-reply configuration columns to whatsapp_automation_config
ALTER TABLE public.whatsapp_automation_config
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_message text DEFAULT 'Olá{nome}! 👋 Recebemos sua mensagem e em breve um de nossos consultores entrará em contato. Obrigado!',
  ADD COLUMN IF NOT EXISTS auto_reply_cooldown_minutes integer NOT NULL DEFAULT 60;

COMMENT ON COLUMN public.whatsapp_automation_config.auto_reply_enabled IS 'Ativa resposta automática instantânea para novos contatos';
COMMENT ON COLUMN public.whatsapp_automation_config.auto_reply_message IS 'Template da mensagem automática. Variáveis: {nome}, {telefone}';
COMMENT ON COLUMN public.whatsapp_automation_config.auto_reply_cooldown_minutes IS 'Cooldown em minutos para evitar spam (padrão: 60min)';