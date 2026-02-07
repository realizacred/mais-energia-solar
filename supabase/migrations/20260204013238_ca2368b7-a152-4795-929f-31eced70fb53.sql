-- Adicionar campo para rastrear visualização pelo admin
ALTER TABLE public.leads
ADD COLUMN visto_admin boolean NOT NULL DEFAULT false;