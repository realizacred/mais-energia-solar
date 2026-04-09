
-- Remove duplicate deal memberships in the "Vendedores" pipeline
DELETE FROM deal_pipeline_stages
WHERE pipeline_id = '611ef5a2-3ec3-4635-a653-5df93020d091';

-- Remove pipeline automations if any
DELETE FROM pipeline_automations
WHERE pipeline_id = '611ef5a2-3ec3-4635-a653-5df93020d091';

-- Remove stage permissions if any
DELETE FROM pipeline_stage_permissions
WHERE stage_id IN (
  SELECT id FROM pipeline_stages
  WHERE pipeline_id = '611ef5a2-3ec3-4635-a653-5df93020d091'
);

-- Remove stages
DELETE FROM pipeline_stages
WHERE pipeline_id = '611ef5a2-3ec3-4635-a653-5df93020d091';

-- Remove the pipeline itself
DELETE FROM pipelines
WHERE id = '611ef5a2-3ec3-4635-a653-5df93020d091';
