ALTER TABLE public.pipeline_stage_validations 
ADD COLUMN IF NOT EXISTS aplicar_a_partir BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.pipeline_stage_validations.aplicar_a_partir IS 'If true, the validation applies to this stage and all subsequent stages in the pipeline.';