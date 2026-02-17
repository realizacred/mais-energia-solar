
-- Add doc_checklist jsonb to deals for document tracking
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS doc_checklist jsonb DEFAULT '{}';

COMMENT ON COLUMN public.deals.doc_checklist IS 'JSON object tracking document checklist status per deal, e.g. {"rg_cnh": true, "conta_luz": false}';
