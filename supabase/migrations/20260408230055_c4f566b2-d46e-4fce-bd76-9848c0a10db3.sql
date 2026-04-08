
-- Add recebida_parcial to the order status enum
ALTER TYPE public.ordem_compra_status ADD VALUE IF NOT EXISTS 'recebida_parcial' AFTER 'em_transito';

-- Add observacao_recebimento column to ordens_compra_itens
ALTER TABLE public.ordens_compra_itens
  ADD COLUMN IF NOT EXISTS observacao_recebimento text;
