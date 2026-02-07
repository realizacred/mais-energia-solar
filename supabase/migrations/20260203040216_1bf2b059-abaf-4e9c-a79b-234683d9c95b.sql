-- Update function to generate simpler vendor codes (just the name, slugified)
CREATE OR REPLACE FUNCTION public.generate_vendedor_codigo()
RETURNS TRIGGER AS $$
DECLARE
  base_codigo TEXT;
  final_codigo TEXT;
  counter INTEGER := 1;
BEGIN
  -- Create base code from name (lowercase, no special chars, replace spaces with hyphens)
  base_codigo := lower(regexp_replace(trim(NEW.nome), '[^a-zA-Z0-9\s]', '', 'g'));
  base_codigo := regexp_replace(base_codigo, '\s+', '-', 'g');
  
  -- Try the base code first
  final_codigo := base_codigo;
  
  -- If it already exists, add a number suffix
  WHILE EXISTS (SELECT 1 FROM public.vendedores WHERE codigo = final_codigo AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
    counter := counter + 1;
    final_codigo := base_codigo || '-' || counter;
  END LOOP;
  
  NEW.codigo := final_codigo;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;