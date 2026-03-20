-- ═══════════════════════════════════════
-- Módulo Faturas de Energia — colunas adicionais
-- ═══════════════════════════════════════

-- 1) units_consumidoras: campos de leitura
ALTER TABLE public.units_consumidoras 
  ADD COLUMN IF NOT EXISTS proxima_leitura_data DATE,
  ADD COLUMN IF NOT EXISTS ultima_leitura_data DATE,
  ADD COLUMN IF NOT EXISTS ultima_leitura_kwh_03 NUMERIC,
  ADD COLUMN IF NOT EXISTS ultima_leitura_kwh_103 NUMERIC;

-- 2) unit_billing_email_settings: e-mail gerado da UC
ALTER TABLE public.unit_billing_email_settings
  ADD COLUMN IF NOT EXISTS email_da_uc TEXT;

-- 3) Storage bucket para PDFs de faturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('faturas-energia', 'faturas-energia', false)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS policies para o bucket faturas-energia
CREATE POLICY "Tenant can view own invoices"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (SELECT current_tenant_id())::text
);

CREATE POLICY "Service role can insert invoices"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'faturas-energia'
  AND (storage.foldername(name))[1] = (SELECT current_tenant_id())::text
);