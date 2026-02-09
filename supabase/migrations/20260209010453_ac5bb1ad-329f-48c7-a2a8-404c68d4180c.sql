-- Criar bucket para anexos do WhatsApp Inbox
INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-attachments', 'wa-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: admins e vendedores podem fazer upload
CREATE POLICY "Authenticated users can upload wa-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'wa-attachments');

-- Policy: qualquer um pode visualizar (público)
CREATE POLICY "Anyone can view wa-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'wa-attachments');

-- Policy: admins podem deletar
CREATE POLICY "Admins can delete wa-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'wa-attachments' AND public.is_admin(auth.uid()));