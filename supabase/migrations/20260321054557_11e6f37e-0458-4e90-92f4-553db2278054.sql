-- Trigger para atribuir status padrão a novos leads sem status_id
CREATE OR REPLACE FUNCTION public.trg_lead_default_status()
RETURNS TRIGGER AS $$
DECLARE
  v_first_status UUID;
BEGIN
  IF NEW.status_id IS NULL THEN
    SELECT id INTO v_first_status
    FROM public.lead_status
    WHERE tenant_id = NEW.tenant_id
    ORDER BY ordem ASC
    LIMIT 1;
    
    IF v_first_status IS NOT NULL THEN
      NEW.status_id := v_first_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_lead_default_status
BEFORE INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_lead_default_status();

-- Corrigir 68 leads existentes sem status
UPDATE public.leads
SET status_id = (
  SELECT ls.id
  FROM public.lead_status ls
  WHERE ls.tenant_id = leads.tenant_id
  ORDER BY ls.ordem ASC
  LIMIT 1
)
WHERE status_id IS NULL
AND deleted_at IS NULL;