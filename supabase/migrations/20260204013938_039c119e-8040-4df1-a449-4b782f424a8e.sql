-- Add document fields to clientes table
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS identidade_url text,
ADD COLUMN IF NOT EXISTS comprovante_endereco_url text,
ADD COLUMN IF NOT EXISTS disjuntor_id uuid REFERENCES public.disjuntores(id),
ADD COLUMN IF NOT EXISTS transformador_id uuid REFERENCES public.transformadores(id),
ADD COLUMN IF NOT EXISTS localizacao text;

-- Add a status to track converted leads (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lead_status WHERE nome = 'Convertido') THEN
    INSERT INTO public.lead_status (nome, cor, ordem)
    VALUES ('Convertido', '#22c55e', 99);
  END IF;
END $$;

-- Create storage bucket for client documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-cliente', 'documentos-cliente', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documentos-cliente bucket
CREATE POLICY "Authenticated users can upload client documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos-cliente');

CREATE POLICY "Authenticated users can view client documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documentos-cliente');

CREATE POLICY "Authenticated users can update client documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos-cliente');

CREATE POLICY "Authenticated users can delete client documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documentos-cliente');