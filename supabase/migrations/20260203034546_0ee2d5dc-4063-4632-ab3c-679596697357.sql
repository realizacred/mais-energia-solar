-- Add lead_code column for human-readable ID
ALTER TABLE public.leads ADD COLUMN lead_code TEXT UNIQUE;

-- Create sequence for lead codes
CREATE SEQUENCE IF NOT EXISTS public.lead_code_seq START 1;

-- Create function to generate lead code
CREATE OR REPLACE FUNCTION public.generate_lead_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lead_code := 'LEAD-' || LPAD(nextval('public.lead_code_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate lead_code on insert
CREATE TRIGGER set_lead_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_lead_code();

-- Update existing leads with sequential codes
DO $$
DECLARE
  lead_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR lead_record IN SELECT id FROM public.leads ORDER BY created_at ASC LOOP
    UPDATE public.leads 
    SET lead_code = 'LEAD-' || LPAD(counter::TEXT, 3, '0')
    WHERE id = lead_record.id;
    counter := counter + 1;
  END LOOP;
  -- Reset sequence to continue from the last used number
  PERFORM setval('public.lead_code_seq', counter - 1);
END $$;