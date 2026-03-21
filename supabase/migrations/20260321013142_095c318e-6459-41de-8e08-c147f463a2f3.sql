-- Trigger: auto-assign first lead_status to new leads without status_id
CREATE OR REPLACE FUNCTION public.set_default_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT id INTO NEW.status_id
    FROM public.lead_status
    WHERE tenant_id = NEW.tenant_id
      AND nome != 'Arquivado'
    ORDER BY ordem ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS trg_set_default_lead_status ON public.leads;

CREATE TRIGGER trg_set_default_lead_status
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_lead_status();