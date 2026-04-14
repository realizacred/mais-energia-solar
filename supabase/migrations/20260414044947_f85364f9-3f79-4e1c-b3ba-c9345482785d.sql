-- Fix deals incorrectly assigned to Engenharia pipeline
-- Move them to Comercial (is_default) with correct stage mapping

-- Stage IDs in Comercial (08404115-6b9f-4949-84da-9061e1689dac):
-- Proposta enviada: 7ae41475-9d21-486e-9551-04eb29afea15
-- Fechado: 77d54560-75a1-4be0-b603-deff82990d42

-- 1. Update deals with status 'open' → Comercial / Proposta enviada
UPDATE public.deals
SET pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac',
    stage_id = '7ae41475-9d21-486e-9551-04eb29afea15',
    updated_at = now()
WHERE pipeline_id = '3a110324-7f4b-42e0-a06f-e19f535c7dc2'
  AND status = 'open';

-- 2. Update deals with status 'won' → Comercial / Fechado
UPDATE public.deals
SET pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac',
    stage_id = '77d54560-75a1-4be0-b603-deff82990d42',
    updated_at = now()
WHERE pipeline_id = '3a110324-7f4b-42e0-a06f-e19f535c7dc2'
  AND status = 'won';

-- 3. Update deals with status 'lost' → Comercial / Fechado
UPDATE public.deals
SET pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac',
    stage_id = '77d54560-75a1-4be0-b603-deff82990d42',
    updated_at = now()
WHERE pipeline_id = '3a110324-7f4b-42e0-a06f-e19f535c7dc2'
  AND status = 'lost';

-- 4. Upsert deal_pipeline_stages for Comercial membership
INSERT INTO public.deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT d.id, d.pipeline_id, d.stage_id, d.tenant_id
FROM public.deals d
WHERE d.pipeline_id = '08404115-6b9f-4949-84da-9061e1689dac'
  AND d.import_source = 'solar_market'
ON CONFLICT (deal_id, pipeline_id)
DO UPDATE SET stage_id = EXCLUDED.stage_id;