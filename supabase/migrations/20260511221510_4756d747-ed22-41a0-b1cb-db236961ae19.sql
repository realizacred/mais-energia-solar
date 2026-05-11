-- Add column if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'telefone_normalized') THEN
    ALTER TABLE public.clientes ADD COLUMN telefone_normalized TEXT;
  END IF;
END $$;

-- Populate existing records
UPDATE public.clientes 
SET telefone_normalized = regexp_replace(regexp_replace(telefone, '\D', '', 'g'), '^55', '')
WHERE telefone IS NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_clientes_telefone_normalized ON public.clientes(telefone_normalized);