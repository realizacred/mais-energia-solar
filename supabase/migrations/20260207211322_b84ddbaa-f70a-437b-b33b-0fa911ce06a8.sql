
-- Function to generate a professional vendedor code
-- Format: First 3 letters of name (uppercase) + 3-digit number (e.g., CLA001)
CREATE OR REPLACE FUNCTION public.generate_vendedor_codigo()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  seq_num INTEGER;
  new_codigo TEXT;
  exists_count INTEGER;
BEGIN
  -- Generate prefix from first 3 letters of name (uppercase, no accents)
  prefix := upper(
    translate(
      substring(regexp_replace(NEW.nome, '[^a-zA-ZÀ-ÿ]', '', 'g') from 1 for 3),
      'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ',
      'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'
    )
  );
  
  -- If name is too short, pad with X
  prefix := rpad(prefix, 3, 'X');
  
  -- Find the next available sequence number for this prefix
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
  
  -- Double-check uniqueness
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate codigo on INSERT
CREATE TRIGGER generate_vendedor_codigo_trigger
BEFORE INSERT ON public.vendedores
FOR EACH ROW
WHEN (NEW.codigo IS NULL OR NEW.codigo = '' OR NEW.codigo = 'temp')
EXECUTE FUNCTION public.generate_vendedor_codigo();

-- Fix existing vendedores with 'temp' code
DO $$
DECLARE
  v RECORD;
  prefix TEXT;
  seq_num INTEGER;
  new_codigo TEXT;
  exists_count INTEGER;
BEGIN
  FOR v IN SELECT id, nome FROM vendedores WHERE codigo = 'temp' OR codigo IS NULL OR codigo = '' LOOP
    prefix := upper(
      translate(
        substring(regexp_replace(v.nome, '[^a-zA-ZÀ-ÿ]', '', 'g') from 1 for 3),
        'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ',
        'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'
      )
    );
    prefix := rpad(prefix, 3, 'X');
    
    seq_num := 1;
    new_codigo := prefix || lpad(seq_num::text, 3, '0');
    
    SELECT COUNT(*) INTO exists_count
    FROM vendedores
    WHERE codigo = new_codigo AND id != v.id;
    
    WHILE exists_count > 0 LOOP
      seq_num := seq_num + 1;
      new_codigo := prefix || lpad(seq_num::text, 3, '0');
      SELECT COUNT(*) INTO exists_count
      FROM vendedores
      WHERE codigo = new_codigo AND id != v.id;
    END LOOP;
    
    UPDATE vendedores SET codigo = new_codigo WHERE id = v.id;
  END LOOP;
END $$;
