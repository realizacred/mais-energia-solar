
-- Set Comercial as is_default
UPDATE public.pipelines 
SET is_default = true 
WHERE id = 'b97133e8-b618-4383-9379-da398d70a3e3' 
  AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Fix sm_migration_settings to point to existing Comercial pipeline + Proposta enviada stage
UPDATE public.sm_migration_settings
SET pipeline_id = 'b97133e8-b618-4383-9379-da398d70a3e3',
    stage_id = '94c5e702-1ece-4af4-8b8e-bc163d51624d',
    updated_at = now()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
