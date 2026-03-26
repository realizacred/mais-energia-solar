
ALTER TABLE public.deal_custom_fields
  ADD COLUMN IF NOT EXISTS visible_pipeline_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS important_stage_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_stage_ids text[] DEFAULT '{}';
