
-- Add avulso (walk-in) fields to post_sale_visits
ALTER TABLE public.post_sale_visits
  ADD COLUMN IF NOT EXISTS nome_avulso text,
  ADD COLUMN IF NOT EXISTS telefone_avulso text;

COMMENT ON COLUMN public.post_sale_visits.nome_avulso IS 'Name for walk-in clients without a clientes record';
COMMENT ON COLUMN public.post_sale_visits.telefone_avulso IS 'Phone for walk-in clients without a clientes record';

-- Add avulso fields to post_sale_upsell_opportunities
ALTER TABLE public.post_sale_upsell_opportunities
  ADD COLUMN IF NOT EXISTS nome_avulso text,
  ADD COLUMN IF NOT EXISTS telefone_avulso text;

-- Make projeto_id and cliente_id nullable on post_sale_plans (currently NOT NULL)
ALTER TABLE public.post_sale_plans
  ALTER COLUMN projeto_id DROP NOT NULL,
  ALTER COLUMN cliente_id DROP NOT NULL;

-- Add avulso fields to post_sale_plans too
ALTER TABLE public.post_sale_plans
  ADD COLUMN IF NOT EXISTS nome_avulso text,
  ADD COLUMN IF NOT EXISTS telefone_avulso text;
