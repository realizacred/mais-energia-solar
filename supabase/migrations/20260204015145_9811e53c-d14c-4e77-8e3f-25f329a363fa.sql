-- Add column for comprovante beneficiaria da UC (multiple files stored as JSON array of URLs)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS comprovante_beneficiaria_urls text[] DEFAULT '{}'::text[];

-- Update existing columns to support multiple files (array of URLs)
-- identidade_url -> identidade_urls (array)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS identidade_urls text[] DEFAULT '{}'::text[];

-- comprovante_endereco_url -> comprovante_endereco_urls (array)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS comprovante_endereco_urls text[] DEFAULT '{}'::text[];

-- Migrate existing single URL data to arrays
UPDATE public.clientes 
SET identidade_urls = ARRAY[identidade_url] 
WHERE identidade_url IS NOT NULL AND (identidade_urls IS NULL OR identidade_urls = '{}');

UPDATE public.clientes 
SET comprovante_endereco_urls = ARRAY[comprovante_endereco_url] 
WHERE comprovante_endereco_url IS NOT NULL AND (comprovante_endereco_urls IS NULL OR comprovante_endereco_urls = '{}');