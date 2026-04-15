
DELETE FROM pipeline_stages WHERE pipeline_id IN (
  SELECT id FROM pipelines
);
DELETE FROM pipelines;
