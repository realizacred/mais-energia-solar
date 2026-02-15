-- Add concessionaria_id to tenant_premises for auto-populating tariff values
ALTER TABLE public.tenant_premises
ADD COLUMN concessionaria_id uuid REFERENCES public.concessionarias(id) ON DELETE SET NULL;