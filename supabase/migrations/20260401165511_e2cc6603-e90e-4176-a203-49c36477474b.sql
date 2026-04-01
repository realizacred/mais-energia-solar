
-- tenant_premises: gateway and billing config columns
ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS gateway_preferido text DEFAULT 'pagseguro',
  ADD COLUMN IF NOT EXISTS pagseguro_token text,
  ADD COLUMN IF NOT EXISTS pagseguro_sandbox boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS asaas_token text,
  ADD COLUMN IF NOT EXISTS asaas_sandbox boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS inter_client_id text,
  ADD COLUMN IF NOT EXISTS inter_client_secret text,
  ADD COLUMN IF NOT EXISTS inter_sandbox boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sicoob_client_id text,
  ADD COLUMN IF NOT EXISTS sicoob_sandbox boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cobranca_multa_percentual numeric(5,2) DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS cobranca_juros_percentual numeric(5,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS cobranca_dias_vencimento integer DEFAULT 30;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_premises_gateway_preferido_check') THEN
    ALTER TABLE public.tenant_premises
      ADD CONSTRAINT tenant_premises_gateway_preferido_check
      CHECK (gateway_preferido IN ('pagseguro','asaas','inter','sicoob'));
  END IF;
END $$;

-- parcelas: billing tracking columns
ALTER TABLE public.parcelas
  ADD COLUMN IF NOT EXISTS cobranca_id text,
  ADD COLUMN IF NOT EXISTS cobranca_gateway text,
  ADD COLUMN IF NOT EXISTS cobranca_status text DEFAULT 'nao_gerada',
  ADD COLUMN IF NOT EXISTS boleto_url text,
  ADD COLUMN IF NOT EXISTS boleto_linha_digitavel text,
  ADD COLUMN IF NOT EXISTS boleto_codigo_barras text,
  ADD COLUMN IF NOT EXISTS pix_qr_code text,
  ADD COLUMN IF NOT EXISTS pix_copia_cola text,
  ADD COLUMN IF NOT EXISTS cobranca_valor_original numeric(10,2),
  ADD COLUMN IF NOT EXISTS cobranca_valor_cobrado numeric(10,2),
  ADD COLUMN IF NOT EXISTS cobranca_multa_aplicada numeric(10,2),
  ADD COLUMN IF NOT EXISTS cobranca_juros_aplicado numeric(10,2),
  ADD COLUMN IF NOT EXISTS cobranca_gerada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_paga_em timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb;
