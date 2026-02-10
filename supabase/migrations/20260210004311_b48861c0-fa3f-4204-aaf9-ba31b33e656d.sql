-- Rename prazo_horas to prazo_minutos and convert existing values (hours → minutes)
ALTER TABLE public.wa_followup_rules 
  RENAME COLUMN prazo_horas TO prazo_minutos;

-- Convert existing values from hours to minutes
UPDATE public.wa_followup_rules 
  SET prazo_minutos = prazo_minutos * 60;

-- Update default from 24 (hours) to 1440 (minutes = 24h)
ALTER TABLE public.wa_followup_rules 
  ALTER COLUMN prazo_minutos SET DEFAULT 1440;