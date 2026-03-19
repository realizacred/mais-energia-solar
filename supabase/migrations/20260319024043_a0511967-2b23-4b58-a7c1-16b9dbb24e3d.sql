
-- PASSO 1: Expandir proposta_email_templates
ALTER TABLE proposta_email_templates ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT 'email';
ALTER TABLE proposta_email_templates ADD COLUMN IF NOT EXISTS corpo_texto text NULL;
ALTER TABLE proposta_email_templates ADD COLUMN IF NOT EXISTS variaveis jsonb NULL;
ALTER TABLE proposta_email_templates ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- PASSO 7: Expandir proposta_config para automação
ALTER TABLE proposta_config ADD COLUMN IF NOT EXISTS auto_envio_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE proposta_config ADD COLUMN IF NOT EXISTS auto_envio_canal text DEFAULT 'whatsapp';
ALTER TABLE proposta_config ADD COLUMN IF NOT EXISTS auto_envio_template_id uuid NULL REFERENCES proposta_email_templates(id);
ALTER TABLE proposta_config ADD COLUMN IF NOT EXISTS auto_envio_delay_minutos integer DEFAULT 0;
