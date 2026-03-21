CREATE TABLE IF NOT EXISTS public.gd_recalc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  reference_year integer NOT NULL,
  reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  trigger_type text NOT NULL DEFAULT 'manual',
  trigger_entity_type text NULL,
  trigger_entity_id uuid NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  requested_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_gd_recalc_queue_tenant ON public.gd_recalc_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gd_recalc_queue_status ON public.gd_recalc_queue(status);
CREATE INDEX IF NOT EXISTS idx_gd_recalc_queue_group_month ON public.gd_recalc_queue(gd_group_id, reference_year, reference_month);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gd_recalc_queue_dedup 
  ON public.gd_recalc_queue(gd_group_id, reference_year, reference_month)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.gd_recalc_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for gd_recalc_queue"
  ON public.gd_recalc_queue
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());