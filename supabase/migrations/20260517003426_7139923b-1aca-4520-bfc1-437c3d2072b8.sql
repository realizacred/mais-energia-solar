-- Rename column in analise_credito
ALTER TABLE public.analise_credito 
RENAME COLUMN eos_proposta_id TO eos_proposta_protocolo;

-- Add onboarding columns to financeiras_config
ALTER TABLE public.financeiras_config 
ADD COLUMN IF NOT EXISTS eos_integrador_id TEXT,
ADD COLUMN IF NOT EXISTS eos_onboarding_step INT DEFAULT 1;

-- Add missing fields to analise_credito for complete EOS payload
ALTER TABLE public.analise_credito
ADD COLUMN IF NOT EXISTS carencia INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS patrimonio NUMERIC,
ADD COLUMN IF NOT EXISTS avalista_nome TEXT,
ADD COLUMN IF NOT EXISTS avalista_cpf TEXT,
ADD COLUMN IF NOT EXISTS avalista_email TEXT,
ADD COLUMN IF NOT EXISTS avalista_data_nascimento DATE,
ADD COLUMN IF NOT EXISTS avalista_telefone TEXT,
ADD COLUMN IF NOT EXISTS avalista_renda_mensal NUMERIC,
ADD COLUMN IF NOT EXISTS avalista_patrimonio NUMERIC,
ADD COLUMN IF NOT EXISTS avalista_cep TEXT,
ADD COLUMN IF NOT EXISTS avalista_rua TEXT,
ADD COLUMN IF NOT EXISTS avalista_bairro TEXT,
ADD COLUMN IF NOT EXISTS avalista_cidade TEXT,
ADD COLUMN IF NOT EXISTS avalista_estado TEXT,
ADD COLUMN IF NOT EXISTS avalista_numero TEXT;