
UPDATE public.pipelines 
SET is_default = true 
WHERE id = '08404115-6b9f-4949-84da-9061e1689dac';

UPDATE public.sm_migration_settings
SET pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac',
    stage_id = (SELECT id FROM public.pipeline_stages WHERE pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac' AND name = 'Proposta enviada' LIMIT 1),
    updated_at = now()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
