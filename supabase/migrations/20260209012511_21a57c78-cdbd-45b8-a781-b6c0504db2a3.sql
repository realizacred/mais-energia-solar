-- Add telefone_normalized to clientes (like leads already has)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefone_normalized TEXT;

-- Populate existing rows
UPDATE public.clientes
SET telefone_normalized = regexp_replace(telefone, '[^0-9]', '', 'g')
WHERE telefone IS NOT NULL AND telefone_normalized IS NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_clientes_telefone_normalized ON public.clientes (telefone_normalized);

-- Auto-populate on insert/update via trigger
CREATE OR REPLACE FUNCTION public.normalize_cliente_telefone()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.telefone IS NOT NULL THEN
    NEW.telefone_normalized := regexp_replace(NEW.telefone, '[^0-9]', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_cliente_telefone
  BEFORE INSERT OR UPDATE OF telefone ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_cliente_telefone();