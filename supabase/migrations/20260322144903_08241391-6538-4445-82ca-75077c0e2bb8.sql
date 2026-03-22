-- Update Energisa extraction config with all fields the parser actually extracts
UPDATE public.invoice_extraction_configs
SET
  required_fields = '["consumo_kwh","valor_total","vencimento","numero_uc","energia_injetada_kwh","energia_compensada_kwh","saldo_gd_acumulado","data_leitura_anterior","data_leitura_atual","dias_leitura","mes_referencia"]'::jsonb,
  optional_fields = '["tarifa_energia_kwh","tarifa_fio_b_kwh","icms_percentual","pis_valor","cofins_valor","bandeira_tarifaria","proxima_leitura_data","leitura_anterior_03","leitura_atual_03","leitura_anterior_103","leitura_atual_103","classe_consumo","modalidade_tarifaria","categoria_gd","demanda_contratada_kw","medidor_consumo_codigo","medidor_injecao_codigo","numero_nota_fiscal"]'::jsonb,
  notes = 'Parser nativo determinístico v3.0.2 — suporte completo DANF3E. Campos GD: injeção, compensação, saldo acumulado, leituras de medidor.',
  updated_at = now()
WHERE concessionaria_code = 'energisa' AND tenant_id IS NULL;