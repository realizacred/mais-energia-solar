
-- =============================================
-- 1. ADD cliente_code column + sequence + trigger
-- =============================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cliente_code TEXT;

CREATE SEQUENCE IF NOT EXISTS public.cliente_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_cliente_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.cliente_code IS NULL THEN
    NEW.cliente_code := 'CLI-' || LPAD(nextval('public.cliente_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_cliente_code ON public.clientes;
CREATE TRIGGER trg_generate_cliente_code
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cliente_code();

-- =============================================
-- 2. ADD projeto_code sequence + trigger (uses existing 'codigo' column)
-- =============================================
CREATE SEQUENCE IF NOT EXISTS public.projeto_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_projeto_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.codigo IS NULL THEN
    NEW.codigo := 'PROJ-' || LPAD(nextval('public.projeto_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_projeto_code ON public.projetos;
CREATE TRIGGER trg_generate_projeto_code
  BEFORE INSERT ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_projeto_code();

-- =============================================
-- 3. RENAME lead prefix CLI- → LEAD-
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_lead_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lead_code IS NULL THEN
    NEW.lead_code := 'LEAD-' || LPAD(nextval('public.lead_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Update existing leads from CLI- to LEAD-
UPDATE public.leads SET lead_code = REPLACE(lead_code, 'CLI-', 'LEAD-') WHERE lead_code LIKE 'CLI-%';

-- =============================================
-- 4. BACKFILL existing clientes without code
-- =============================================
UPDATE public.clientes 
SET cliente_code = 'CLI-' || LPAD(nextval('public.cliente_code_seq')::TEXT, 4, '0')
WHERE cliente_code IS NULL;

-- =============================================
-- 5. BACKFILL existing projetos without codigo
-- =============================================
UPDATE public.projetos 
SET codigo = 'PROJ-' || LPAD(nextval('public.projeto_code_seq')::TEXT, 4, '0')
WHERE codigo IS NULL;

-- =============================================
-- 6. Create unique index on cliente_code
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cliente_code ON public.clientes(cliente_code) WHERE cliente_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projetos_codigo ON public.projetos(codigo) WHERE codigo IS NOT NULL;
