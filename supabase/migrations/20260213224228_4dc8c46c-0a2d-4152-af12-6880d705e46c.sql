-- Canal de Captação: add origem column to leads for source tracking
-- Hardening: nullable text, no enum, no breaking change
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS origem text;

COMMENT ON COLUMN public.leads.origem IS
'Origem do lead: canal_consultor, site, manual, whatsapp, etc. Nullable para retrocompatibilidade.';

-- No RLS change needed: column is covered by existing row-level policies
-- No index needed: not used in WHERE clauses for hot paths