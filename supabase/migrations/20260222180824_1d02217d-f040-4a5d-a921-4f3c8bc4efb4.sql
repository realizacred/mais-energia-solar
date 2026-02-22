
-- 1) Trigger to auto-assign deal_num on deals INSERT (same pattern as projetos)
CREATE OR REPLACE FUNCTION public.trg_deals_assign_num()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_num IS NULL THEN
    NEW.deal_num := public.next_tenant_number(NEW.tenant_id, 'deal');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_deals_auto_num
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_deals_assign_num();

-- 2) Add deal_num to deal_kanban_projection if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='deal_kanban_projection' AND column_name='deal_num'
  ) THEN
    ALTER TABLE public.deal_kanban_projection ADD COLUMN deal_num bigint;
  END IF;
END$$;

-- 3) Ensure propostas_nativas.titulo has a default (NOT NULL with default)
ALTER TABLE public.propostas_nativas ALTER COLUMN titulo SET DEFAULT 'Proposta sem título';
ALTER TABLE public.propostas_nativas ALTER COLUMN titulo SET NOT NULL;

-- 4) Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deals_tenant_num ON public.deals(tenant_id, deal_num);
CREATE INDEX IF NOT EXISTS idx_kanban_proj_deal_num ON public.deal_kanban_projection(deal_num);
