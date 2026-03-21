-- Drop e recria trigger para garantir vinculação
DROP TRIGGER IF EXISTS trg_lead_default_status ON public.leads;
DROP TRIGGER IF EXISTS trg_set_default_lead_status ON public.leads;

CREATE TRIGGER trg_lead_default_status
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_lead_default_status();