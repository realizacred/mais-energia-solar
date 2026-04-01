
ALTER TABLE public.recebimentos
  ADD COLUMN IF NOT EXISTS composicao_acordada jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_pago numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_pagamento_em timestamptz;

CREATE OR REPLACE FUNCTION public.sync_recebimento_total_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recebimento_id uuid := coalesce(new.recebimento_id, old.recebimento_id);
  v_total numeric(10,2);
  v_ultimo timestamptz;
BEGIN
  SELECT coalesce(sum(valor_pago),0), max(data_pagamento::timestamptz)
    INTO v_total, v_ultimo
  FROM public.pagamentos
  WHERE recebimento_id = v_recebimento_id;

  UPDATE public.recebimentos r
  SET total_pago = v_total,
      ultimo_pagamento_em = v_ultimo,
      status = CASE 
        WHEN v_total <= 0 THEN 'pendente' 
        WHEN v_total >= r.valor_total THEN 'quitado' 
        ELSE 'parcial' 
      END
  WHERE r.id = v_recebimento_id;

  RETURN coalesce(new, old);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_total_pago ON public.pagamentos;
CREATE TRIGGER trg_sync_total_pago
  AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.sync_recebimento_total_pago();
