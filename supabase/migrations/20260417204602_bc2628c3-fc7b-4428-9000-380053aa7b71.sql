ALTER TABLE public.sm_project_classification
  ADD COLUMN IF NOT EXISTS target_funnel_name text,
  ADD COLUMN IF NOT EXISTS target_stage_name text,
  ADD COLUMN IF NOT EXISTS resolved_funil_id uuid REFERENCES public.projeto_funis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_etapa_id uuid REFERENCES public.projeto_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_status text NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending','resolved','skipped','error')),
  ADD COLUMN IF NOT EXISTS resolution_error text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sm_pc_resolution_status
  ON public.sm_project_classification(tenant_id, resolution_status);

CREATE INDEX IF NOT EXISTS idx_sm_pc_resolved_funil
  ON public.sm_project_classification(resolved_funil_id)
  WHERE resolved_funil_id IS NOT NULL;