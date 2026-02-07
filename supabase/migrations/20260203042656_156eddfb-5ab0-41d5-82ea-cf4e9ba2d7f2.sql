-- Drop existing trigger and function with CASCADE
DROP TRIGGER IF EXISTS generate_vendedor_codigo_trigger ON public.vendedores;
DROP FUNCTION IF EXISTS public.generate_vendedor_codigo() CASCADE;

-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create function to generate slug from name with accent removal
CREATE OR REPLACE FUNCTION public.generate_vendedor_codigo()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert name to lowercase slug (remove accents and special chars)
  base_slug := lower(unaccent(NEW.nome));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
  
  -- Start with base slug
  final_slug := base_slug;
  
  -- Check for duplicates and add number if needed
  WHILE EXISTS (SELECT 1 FROM public.vendedores WHERE codigo = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  NEW.codigo := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for new vendedores
CREATE TRIGGER generate_vendedor_codigo_trigger
BEFORE INSERT ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.generate_vendedor_codigo();

-- Update existing vendedor "Receber" to use proper slug
UPDATE public.vendedores 
SET codigo = lower(regexp_replace(regexp_replace(nome, '[^a-zA-Z0-9]+', '-', 'g'), '^-|-$', '', 'g'));