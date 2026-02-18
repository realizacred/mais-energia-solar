
-- Fix: Add "Bruno Martins" deal to Comercial pipeline (Prospecção stage)
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id)
SELECT 'f83f5700-0914-4938-87f9-cc4ffe65dfe5', '9b5cbcf3-a101-4950-b699-778e2e1219e6', '686ea5dd-d0bb-4038-826b-7c7ac74455fb'
WHERE NOT EXISTS (
  SELECT 1 FROM deal_pipeline_stages 
  WHERE deal_id = 'f83f5700-0914-4938-87f9-cc4ffe65dfe5' 
  AND pipeline_id = '9b5cbcf3-a101-4950-b699-778e2e1219e6'
);
