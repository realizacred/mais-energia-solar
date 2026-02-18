-- Adicionar coluna precisao à tabela proposta_variaveis_custom
ALTER TABLE public.proposta_variaveis_custom 
ADD COLUMN IF NOT EXISTS precisao integer NOT NULL DEFAULT 2;