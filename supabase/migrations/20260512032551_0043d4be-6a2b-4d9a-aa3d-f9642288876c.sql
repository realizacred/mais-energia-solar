
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS signed_pdf_path text;

CREATE INDEX IF NOT EXISTS idx_generated_documents_pending_archive
  ON public.generated_documents (signature_status, signed_pdf_path)
  WHERE signature_status = 'signed' AND signed_pdf_path IS NULL;

-- pg_cron: arquiva PDFs assinados pendentes a cada 5 minutos
DO $$
BEGIN
  PERFORM cron.unschedule('signature-archive-pending-5m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'signature-archive-pending-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bguhckqkpnziykpbwbeu.supabase.co/functions/v1/signature-archive-pending',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
