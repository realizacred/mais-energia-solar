
-- Create table for AI-generated commercial insights
CREATE TABLE public.ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  insight_type text NOT NULL, -- daily_summary | alert | action_plan | weekly_report
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by_user_id uuid,
  period_start date,
  period_end date,
  filters jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Only admins/gerentes can manage insights
CREATE POLICY "Admins manage ai_insights"
ON public.ai_insights
FOR ALL
USING (is_admin(auth.uid()));

-- Index for fast lookup
CREATE INDEX idx_ai_insights_type_created ON public.ai_insights(insight_type, created_at DESC);
CREATE INDEX idx_ai_insights_tenant ON public.ai_insights(tenant_id);

-- Add comment
COMMENT ON TABLE public.ai_insights IS 'Stores AI-generated commercial intelligence insights (summaries, alerts, action plans)';
