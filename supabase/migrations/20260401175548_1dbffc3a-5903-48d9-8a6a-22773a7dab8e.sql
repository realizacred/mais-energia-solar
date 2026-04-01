
-- Add new columns to pagamentos table
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES parcelas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS banco_origem text,
  ADD COLUMN IF NOT EXISTS numero_cheque text,
  ADD COLUMN IF NOT EXISTS numero_autorizacao text,
  ADD COLUMN IF NOT EXISTS gateway_utilizado text,
  ADD COLUMN IF NOT EXISTS numero_parcelas_cartao int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS observacoes_internas text;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-pagamento', 'comprovantes-pagamento', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload comprovantes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes-pagamento');

CREATE POLICY "Authenticated users can view comprovantes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes-pagamento');

CREATE POLICY "Authenticated users can delete comprovantes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes-pagamento');
