
-- Adicionar coluna aceite_motivo para salvar motivo do aceite
ALTER TABLE public.propostas_nativas
ADD COLUMN IF NOT EXISTS aceite_motivo text;
