-- Fix Cemig config: correct field names to match parser output
UPDATE invoice_extraction_configs 
SET 
  required_fields = '["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia", "data_leitura_anterior", "data_leitura_atual", "dias_leitura"]'::jsonb,
  optional_fields = '["energia_injetada_kwh", "energia_compensada_kwh", "saldo_gd_acumulado", "proxima_leitura_data", "tarifa_energia_kwh", "bandeira_tarifaria", "classe_consumo"]'::jsonb,
  identifier_field = 'numero_uc',
  updated_at = now()
WHERE concessionaria_code = 'cemig' AND tenant_id IS NULL;

-- Fix Enel config
UPDATE invoice_extraction_configs 
SET 
  required_fields = '["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia", "data_leitura_anterior", "data_leitura_atual", "dias_leitura"]'::jsonb,
  optional_fields = '["energia_injetada_kwh", "energia_compensada_kwh", "saldo_gd_acumulado", "proxima_leitura_data", "tarifa_energia_kwh", "bandeira_tarifaria", "classe_consumo"]'::jsonb,
  identifier_field = 'numero_cliente',
  updated_at = now()
WHERE concessionaria_code = 'enel' AND tenant_id IS NULL;

-- Fix Light config
UPDATE invoice_extraction_configs 
SET 
  required_fields = '["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia", "data_leitura_anterior", "data_leitura_atual", "dias_leitura"]'::jsonb,
  optional_fields = '["energia_injetada_kwh", "energia_compensada_kwh", "saldo_gd_acumulado", "proxima_leitura_data", "tarifa_energia_kwh", "bandeira_tarifaria", "classe_consumo"]'::jsonb,
  identifier_field = 'numero_cliente',
  updated_at = now()
WHERE concessionaria_code = 'light' AND tenant_id IS NULL;