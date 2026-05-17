-- Add columns to document_signers
ALTER TABLE public.document_signers
  ADD COLUMN IF NOT EXISTS assinado_por_tipo TEXT DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS assinado_at TIMESTAMPTZ;

-- Add comment for column values
COMMENT ON COLUMN public.document_signers.assinado_por_tipo IS 'Type of signature: digital or fisico';

-- Add columns to generated_documents
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS descricao_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS pdf_cancelado_url TEXT;

-- Update status of document if not already existing (it usually is text, but let''s ensure documentation of expected values)
-- Expected statuses: rascunho, gerado, aguardando_assinatura, assinado_parcial, assinado_completo, cancelado, substituido
