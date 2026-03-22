-- Add context-aware required fields for geradora vs beneficiária
ALTER TABLE invoice_extraction_configs 
  ADD COLUMN IF NOT EXISTS required_fields_geradora jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_beneficiaria jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing data: copy required_fields to geradora, create subset for beneficiária
UPDATE invoice_extraction_configs 
SET 
  required_fields_geradora = required_fields,
  required_fields_beneficiaria = (
    SELECT jsonb_agg(f)
    FROM jsonb_array_elements_text(required_fields) AS f
    WHERE f NOT IN ('energia_injetada_kwh', 'saldo_gd_acumulado', 'leitura_anterior_103', 'leitura_atual_103', 'medidor_injecao_codigo', 'categoria_gd')
  );

-- Handle null case from the WHERE filter
UPDATE invoice_extraction_configs 
SET required_fields_beneficiaria = '["consumo_kwh", "valor_total", "vencimento", "numero_uc", "mes_referencia"]'::jsonb
WHERE required_fields_beneficiaria IS NULL;

COMMENT ON COLUMN invoice_extraction_configs.required_fields_geradora IS 'Campos obrigatórios quando a UC é geradora (injeta energia)';
COMMENT ON COLUMN invoice_extraction_configs.required_fields_beneficiaria IS 'Campos obrigatórios quando a UC é beneficiária (recebe créditos)';