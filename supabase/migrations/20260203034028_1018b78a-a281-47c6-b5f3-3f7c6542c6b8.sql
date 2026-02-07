-- Add address columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS rua text,
ADD COLUMN IF NOT EXISTS numero text,
ADD COLUMN IF NOT EXISTS bairro text,
ADD COLUMN IF NOT EXISTS complemento text;