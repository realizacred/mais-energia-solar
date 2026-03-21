
-- price_variant_history: log of weight adjustments
CREATE TABLE public.price_variant_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES public.price_variants(id) ON DELETE CASCADE,
  old_weight INTEGER NOT NULL,
  new_weight INTEGER NOT NULL,
  conversion_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  upgrades INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_variant_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read variant history"
  ON public.price_variant_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE INDEX idx_variant_history_variant ON public.price_variant_history(variant_id);
CREATE INDEX idx_variant_history_created ON public.price_variant_history(created_at DESC);
