-- Rename column client_id to eos_api_key in financeiras_config
ALTER TABLE public.financeiras_config RENAME COLUMN client_id TO eos_api_key;

-- Remove client_secret column from financeiras_config
ALTER TABLE public.financeiras_config DROP COLUMN client_secret;

-- Insert EOS Financiamento Solar into credit_bank_configs
-- Note: Using a subquery to get a valid tenant_id if possible, or allowing it to be null if the column allows
INSERT INTO public.credit_bank_configs (tenant_id, bank_name, slug, is_active, technical_metadata)
SELECT tenant_id, 'EOS Financiamento Solar', 'eos', true, '{"tipo": "api_integrada", "endpoint": "eosfin.com.br"}'::jsonb
FROM (SELECT DISTINCT tenant_id FROM public.credit_bank_configs LIMIT 1) as t
ON CONFLICT DO NOTHING;
