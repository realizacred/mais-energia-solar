-- Seed default financing banks with BCB codes
INSERT INTO public.financiamento_bancos (nome, taxa_mensal, max_parcelas, ativo, ordem, codigo_bcb, fonte_sync)
VALUES
  ('Santander', 1.49, 60, true, 1, '033', 'manual'),
  ('BV Financeira', 1.59, 60, true, 2, '655', 'manual'),
  ('Banco do Brasil', 1.39, 60, true, 3, '001', 'manual'),
  ('Caixa Econômica', 1.29, 60, true, 4, '104', 'manual')
ON CONFLICT DO NOTHING;

-- Ensure financiamento_api_config has a default row for sync tracking
INSERT INTO public.financiamento_api_config (nome, ativo)
VALUES ('Configuração de API', true)
ON CONFLICT DO NOTHING;