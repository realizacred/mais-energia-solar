-- Add is_system column to protect system statuses from deletion
ALTER TABLE public.lead_status 
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Mark all essential system statuses as protected
UPDATE public.lead_status SET is_system = true 
WHERE nome IN ('Novo', 'Em Contato', 'Proposta Enviada', 'Aguardando Documentação', 'Aguardando Validação', 'Convertido', 'Perdido', 'Arquivado');

-- Create trigger function to prevent deletion of system statuses
CREATE OR REPLACE FUNCTION public.guard_system_lead_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'Status do sistema "%" não pode ser excluído.', OLD.nome;
  END IF;
  RETURN OLD;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_guard_system_lead_status ON public.lead_status;
CREATE TRIGGER trg_guard_system_lead_status
  BEFORE DELETE ON public.lead_status
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_system_lead_status();

-- Also prevent renaming system statuses
CREATE OR REPLACE FUNCTION public.guard_system_lead_status_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true AND NEW.nome <> OLD.nome THEN
    RAISE EXCEPTION 'Nome do status do sistema "%" não pode ser alterado.', OLD.nome;
  END IF;
  IF OLD.is_system = true AND NEW.is_system = false THEN
    RAISE EXCEPTION 'Flag is_system do status "%" não pode ser removida.', OLD.nome;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_lead_status_update ON public.lead_status;
CREATE TRIGGER trg_guard_system_lead_status_update
  BEFORE UPDATE ON public.lead_status
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_system_lead_status_update();