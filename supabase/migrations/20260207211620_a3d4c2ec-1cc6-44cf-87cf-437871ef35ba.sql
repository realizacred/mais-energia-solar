
-- Add slug column to vendedores
ALTER TABLE public.vendedores ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS vendedores_slug_unique ON public.vendedores(slug) WHERE slug IS NOT NULL;

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_vendedor_slug(nome TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Lowercase, remove accents, replace spaces/special chars with hyphens
  base_slug := lower(
    translate(
      nome,
      'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ',
      'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'
    )
  );
  -- Replace non-alphanumeric chars with hyphens
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  -- Trim leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Update the existing trigger function to also generate slug
CREATE OR REPLACE FUNCTION public.generate_vendedor_codigo()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_codigo TEXT;
  exists_count INTEGER;
  base_slug TEXT;
  final_slug TEXT;
  slug_suffix INTEGER;
BEGIN
  -- Generate codigo if needed
  IF NEW.codigo IS NULL OR NEW.codigo = '' OR NEW.codigo = 'temp' THEN
    prefix := upper(
      translate(
        substring(regexp_replace(NEW.nome, '[^a-zA-ZÀ-ÿ]', '', 'g') from 1 for 3),
        'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ',
        'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'
      )
    );
    prefix := rpad(prefix, 3, 'X');
    
    SELECT COALESCE(MAX(
      CASE 
        WHEN substring(codigo from 4) ~ '^\d+$' 
        THEN substring(codigo from 4)::integer 
        ELSE 0 
      END
    ), 0) + 1
    INTO seq_num
    FROM vendedores
    WHERE upper(substring(codigo from 1 for 3)) = prefix
      AND id != NEW.id;
    
    new_codigo := prefix || lpad(seq_num::text, 3, '0');
    
    SELECT COUNT(*) INTO exists_count
    FROM vendedores
    WHERE codigo = new_codigo AND id != NEW.id;
    
    WHILE exists_count > 0 LOOP
      seq_num := seq_num + 1;
      new_codigo := prefix || lpad(seq_num::text, 3, '0');
      SELECT COUNT(*) INTO exists_count
      FROM vendedores
      WHERE codigo = new_codigo AND id != NEW.id;
    END LOOP;
    
    NEW.codigo := new_codigo;
  END IF;

  -- Always generate slug from nome
  base_slug := generate_vendedor_slug(NEW.nome);
  final_slug := base_slug;
  slug_suffix := 1;
  
  -- Ensure uniqueness
  LOOP
    SELECT COUNT(*) INTO exists_count
    FROM vendedores
    WHERE slug = final_slug AND id != NEW.id;
    
    EXIT WHEN exists_count = 0;
    
    slug_suffix := slug_suffix + 1;
    final_slug := base_slug || '-' || slug_suffix;
  END LOOP;
  
  NEW.slug := final_slug;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop old trigger and recreate to fire on ALL inserts (not just temp codes)
DROP TRIGGER IF EXISTS generate_vendedor_codigo_trigger ON public.vendedores;

CREATE TRIGGER generate_vendedor_codigo_trigger
BEFORE INSERT ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.generate_vendedor_codigo();

-- Also add trigger for UPDATE (to regenerate slug when name changes)
CREATE OR REPLACE FUNCTION public.update_vendedor_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  exists_count INTEGER;
  slug_suffix INTEGER;
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    base_slug := generate_vendedor_slug(NEW.nome);
    final_slug := base_slug;
    slug_suffix := 1;
    
    LOOP
      SELECT COUNT(*) INTO exists_count
      FROM vendedores
      WHERE slug = final_slug AND id != NEW.id;
      
      EXIT WHEN exists_count = 0;
      
      slug_suffix := slug_suffix + 1;
      final_slug := base_slug || '-' || slug_suffix;
    END LOOP;
    
    NEW.slug := final_slug;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_vendedor_slug_trigger
BEFORE UPDATE ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.update_vendedor_slug();

-- Fix existing vendedores: generate slugs
DO $$
DECLARE
  v RECORD;
  base_slug TEXT;
  final_slug TEXT;
  exists_count INTEGER;
  slug_suffix INTEGER;
BEGIN
  FOR v IN SELECT id, nome FROM vendedores WHERE slug IS NULL OR slug = '' ORDER BY created_at LOOP
    base_slug := generate_vendedor_slug(v.nome);
    final_slug := base_slug;
    slug_suffix := 1;
    
    LOOP
      SELECT COUNT(*) INTO exists_count
      FROM vendedores
      WHERE slug = final_slug AND id != v.id;
      
      EXIT WHEN exists_count = 0;
      
      slug_suffix := slug_suffix + 1;
      final_slug := base_slug || '-' || slug_suffix;
    END LOOP;
    
    UPDATE vendedores SET slug = final_slug WHERE id = v.id;
  END LOOP;
END $$;

-- Update the RPC to also search by slug
CREATE OR REPLACE FUNCTION public.validate_vendedor_code(_codigo TEXT)
RETURNS TABLE(codigo TEXT, nome TEXT) AS $$
  SELECT v.codigo, v.nome
  FROM vendedores v
  WHERE (v.codigo = _codigo OR v.slug = _codigo)
    AND v.ativo = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
