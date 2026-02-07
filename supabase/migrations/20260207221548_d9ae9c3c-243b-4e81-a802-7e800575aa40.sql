
-- Recreate sequences (if not exist)
CREATE SEQUENCE IF NOT EXISTS public.lead_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.orcamento_code_seq;

-- Reset sequences to max existing values
DO $$
DECLARE
  max_lead INTEGER;
  max_orc INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN lead_code ~ '^\d+$' THEN lead_code::INTEGER
      WHEN lead_code ~ '-(\d+)$' THEN (regexp_match(lead_code, '-(\d+)$'))[1]::INTEGER
      ELSE 0 
    END
  ), 0) INTO max_lead FROM leads WHERE lead_code IS NOT NULL;
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN orc_code ~ '^\d+$' THEN orc_code::INTEGER
      WHEN orc_code ~ '-(\d+)$' THEN (regexp_match(orc_code, '-(\d+)$'))[1]::INTEGER
      ELSE 0 
    END
  ), 0) INTO max_orc FROM orcamentos WHERE orc_code IS NOT NULL;

  -- Count total leads/orcamentos to ensure sequence is ahead
  max_lead := GREATEST(max_lead, (SELECT COUNT(*) FROM leads));
  max_orc := GREATEST(max_orc, (SELECT COUNT(*) FROM orcamentos));
  
  PERFORM setval('public.lead_code_seq', GREATEST(max_lead, 1));
  PERFORM setval('public.orcamento_code_seq', GREATEST(max_orc, 1));
END $$;

-- Create function to generate lead code with CLI- prefix
CREATE OR REPLACE FUNCTION public.generate_lead_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_code IS NULL THEN
    NEW.lead_code := 'CLI-' || LPAD(nextval('public.lead_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create function to generate orcamento code with ORC- prefix
CREATE OR REPLACE FUNCTION public.generate_orc_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.orc_code IS NULL THEN
    NEW.orc_code := 'ORC-' || LPAD(nextval('public.orcamento_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER set_lead_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_lead_code();

CREATE TRIGGER set_orc_code
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_orc_code();

-- Backfill existing leads without lead_code
DO $$
DECLARE
  lead_record RECORD;
BEGIN
  FOR lead_record IN 
    SELECT id FROM leads WHERE lead_code IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE leads 
    SET lead_code = 'CLI-' || LPAD(nextval('public.lead_code_seq')::TEXT, 4, '0')
    WHERE id = lead_record.id;
  END LOOP;
END $$;

-- Backfill existing orcamentos without orc_code
DO $$
DECLARE
  orc_record RECORD;
BEGIN
  FOR orc_record IN 
    SELECT id FROM orcamentos WHERE orc_code IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE orcamentos 
    SET orc_code = 'ORC-' || LPAD(nextval('public.orcamento_code_seq')::TEXT, 4, '0')
    WHERE id = orc_record.id;
  END LOOP;
END $$;
