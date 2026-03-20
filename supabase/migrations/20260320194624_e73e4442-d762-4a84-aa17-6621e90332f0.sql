
-- Fase 1.1: Novas colunas de configuração do serviço de faturas por UC
-- Adiciona campos para controle de leitura, alertas e ativação do serviço

-- Enum para canal de notificação
CREATE TYPE public.billing_notification_channel AS ENUM ('whatsapp', 'email', 'ambos');

-- Novas colunas
ALTER TABLE public.unit_billing_email_settings
  ADD COLUMN IF NOT EXISTS dia_leitura smallint DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dias_antecedencia_alerta smallint DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canal_notificacao public.billing_notification_channel DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS servico_fatura_ativo boolean DEFAULT false;

-- Constraints de validação
ALTER TABLE public.unit_billing_email_settings
  ADD CONSTRAINT chk_dia_leitura CHECK (dia_leitura IS NULL OR (dia_leitura >= 1 AND dia_leitura <= 31)),
  ADD CONSTRAINT chk_dias_antecedencia CHECK (dias_antecedencia_alerta >= 0 AND dias_antecedencia_alerta <= 15);

-- Comentários para documentação
COMMENT ON COLUMN public.unit_billing_email_settings.dia_leitura IS 'Dia do mês em que a concessionária faz a leitura (1-31)';
COMMENT ON COLUMN public.unit_billing_email_settings.dias_antecedencia_alerta IS 'Quantos dias antes da leitura enviar alerta ao cliente (default 1)';
COMMENT ON COLUMN public.unit_billing_email_settings.canal_notificacao IS 'Canal para envio de alertas: whatsapp, email ou ambos';
COMMENT ON COLUMN public.unit_billing_email_settings.servico_fatura_ativo IS 'Se o serviço de gestão de faturas está ativo para esta UC';
