-- Allow global/system-default extraction configs (tenant_id NULL = system default)
ALTER TABLE public.invoice_extraction_configs ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.invoice_extraction_configs ALTER COLUMN tenant_id DROP DEFAULT;

-- Seed default extraction configs for 4 main concessionárias (idempotent, global)
INSERT INTO public.invoice_extraction_configs (
  tenant_id, concessionaria_code, concessionaria_nome, strategy_mode,
  native_enabled, provider_enabled, provider_name, provider_endpoint_key,
  provider_requires_base64, provider_requires_password,
  fallback_enabled, required_fields, optional_fields,
  parser_version, active, notes
)
SELECT NULL::uuid, v.concessionaria_code, v.concessionaria_nome, v.strategy_mode::extraction_strategy_mode,
       v.native_enabled, v.provider_enabled, v.provider_name, v.provider_endpoint_key,
       v.provider_requires_base64, v.provider_requires_password,
       v.fallback_enabled, v.required_fields::jsonb, v.optional_fields::jsonb,
       v.parser_version, true, v.notes
FROM (VALUES
  ('energisa', 'Energisa', 'native', true, false, NULL::text, NULL::text, false, false, false,
   '["consumo_kwh","valor_total","vencimento","numero_uc","energia_injetada_kwh","saldo_gd_acumulado"]',
   '["energia_compensada_kwh","tarifa_energia_kwh","tarifa_fio_b_kwh","icms_percentual","pis_valor","cofins_valor"]',
   '3.0.2', 'Parser nativo determinístico v3.0.2 — suporte completo DANF3E'),
  ('light', 'Light', 'provider', false, true, 'infosimples', 'light', true, false, false,
   '["consumo_kwh","valor_total","vencimento","numero_uc","leitura_data","leitura_data_anterior"]',
   '["energia_injetada_kwh","saldo_gd_acumulado","proxima_leitura_data"]',
   NULL::text, 'Extração via Infosimples — requer pdf_base64 no backend'),
  ('enel', 'Enel', 'auto', false, true, 'infosimples', 'enel', true, true, true,
   '["consumo_kwh","valor_total","vencimento","numero_uc","leitura_data","leitura_data_anterior"]',
   '["energia_injetada_kwh","saldo_gd_acumulado","proxima_leitura_data"]',
   NULL::text, 'Modo auto com fallback — provedor Infosimples, pode exigir senha do PDF'),
  ('cemig', 'Cemig', 'auto', false, true, 'infosimples', 'cemig', true, false, true,
   '["consumo_kwh","valor_total","vencimento","numero_uc","leitura_data","leitura_data_anterior"]',
   '["energia_injetada_kwh","saldo_gd_acumulado","proxima_leitura_data"]',
   NULL::text, 'Modo auto com fallback — provedor Infosimples')
) AS v(concessionaria_code, concessionaria_nome, strategy_mode,
       native_enabled, provider_enabled, provider_name, provider_endpoint_key,
       provider_requires_base64, provider_requires_password, fallback_enabled,
       required_fields, optional_fields, parser_version, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_extraction_configs ec
  WHERE ec.concessionaria_code = v.concessionaria_code AND ec.tenant_id IS NULL
);

-- Add RLS policy for reading global configs (tenant_id IS NULL)
CREATE POLICY "Anyone can read global extraction configs"
  ON public.invoice_extraction_configs
  FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL);