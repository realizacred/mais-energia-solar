
-- Enums
DO $$ BEGIN
  CREATE TYPE public.chart_engine AS ENUM ('rendered_image', 'docx_native');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.chart_type AS ENUM ('bar', 'line', 'pie', 'doughnut', 'area', 'stacked_bar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.proposal_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  placeholder TEXT NOT NULL,
  chart_type public.chart_type NOT NULL DEFAULT 'bar',
  engine public.chart_engine NOT NULL DEFAULT 'rendered_image',
  data_source TEXT NOT NULL DEFAULT '',
  label_field TEXT NOT NULL DEFAULT 'label',
  value_field TEXT NOT NULL DEFAULT 'value',
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  colors JSONB DEFAULT '[]'::jsonb,
  chart_options JSONB DEFAULT '{}'::jsonb,
  width INTEGER NOT NULL DEFAULT 1600,
  height INTEGER NOT NULL DEFAULT 900,
  show_legend BOOLEAN NOT NULL DEFAULT true,
  show_grid BOOLEAN NOT NULL DEFAULT true,
  show_labels BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, placeholder)
);

ALTER TABLE public.proposal_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_charts_sel" ON public.proposal_charts
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "proposal_charts_ins" ON public.proposal_charts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "proposal_charts_upd" ON public.proposal_charts
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "proposal_charts_del" ON public.proposal_charts
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE TRIGGER proposal_charts_set_updated_at
  BEFORE UPDATE ON public.proposal_charts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
