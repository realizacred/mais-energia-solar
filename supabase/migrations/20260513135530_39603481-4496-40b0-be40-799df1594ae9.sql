-- Add show_on_proposal flag to control visibility in "Alterar Proposta" modal
ALTER TABLE public.deal_custom_fields
ADD COLUMN IF NOT EXISTS show_on_proposal boolean NOT NULL DEFAULT false;

-- Backfill: any field already required on proposal must also be shown
UPDATE public.deal_custom_fields
SET show_on_proposal = true
WHERE required_on_proposal = true AND show_on_proposal = false;

-- Consistency trigger: required_on_proposal=true forces show_on_proposal=true
CREATE OR REPLACE FUNCTION public.enforce_show_on_proposal_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.required_on_proposal = true AND COALESCE(NEW.show_on_proposal, false) = false THEN
    NEW.show_on_proposal := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_show_on_proposal ON public.deal_custom_fields;
CREATE TRIGGER trg_enforce_show_on_proposal
BEFORE INSERT OR UPDATE ON public.deal_custom_fields
FOR EACH ROW
EXECUTE FUNCTION public.enforce_show_on_proposal_consistency();