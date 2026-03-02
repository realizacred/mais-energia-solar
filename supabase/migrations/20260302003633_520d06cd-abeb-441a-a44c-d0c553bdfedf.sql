
-- Insert Fabio Barral's deal into deal_pipeline_stages for the Comercial pipeline at Prospecção
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT 
  '69a47a86-47d5-4b21-a857-a376e20d6c2c',
  '9b5cbcf3-a101-4950-b699-778e2e1219e6',
  '686ea5dd-d0bb-4038-826b-7c7ac74455fb',
  d.tenant_id
FROM deals d
WHERE d.id = '69a47a86-47d5-4b21-a857-a376e20d6c2c'
ON CONFLICT DO NOTHING;

-- Also sync the deal's own stage_id to Prospecção
UPDATE deals
SET stage_id = '686ea5dd-d0bb-4038-826b-7c7ac74455fb', updated_at = now()
WHERE id = '69a47a86-47d5-4b21-a857-a376e20d6c2c';
