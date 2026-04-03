
-- 1) Fix pipeline_stages: mark "Ganho" as is_won + is_closed, "Perdido" as is_closed
UPDATE pipeline_stages
SET is_won = true, is_closed = true
WHERE name = 'Ganho' AND (is_won = false OR is_closed = false);

UPDATE pipeline_stages
SET is_won = false, is_closed = true
WHERE name = 'Perdido' AND is_closed = false;

-- 2) Fix deals with status='won' but stage_id not pointing to a won stage
UPDATE deals d
SET stage_id = (
  SELECT ps.id FROM pipeline_stages ps
  WHERE ps.pipeline_id = d.pipeline_id
    AND ps.is_won = true
  LIMIT 1
)
WHERE d.status = 'won'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps2
  WHERE ps2.id = d.stage_id AND ps2.is_won = true
)
AND EXISTS (
  SELECT 1 FROM pipeline_stages ps3
  WHERE ps3.pipeline_id = d.pipeline_id AND ps3.is_won = true
);

-- 3) Fix deals with status='lost' but stage_id not pointing to a closed (non-won) stage
UPDATE deals d
SET stage_id = (
  SELECT ps.id FROM pipeline_stages ps
  WHERE ps.pipeline_id = d.pipeline_id
    AND ps.is_closed = true AND ps.is_won = false
  LIMIT 1
)
WHERE d.status = 'lost'
AND NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps2
  WHERE ps2.id = d.stage_id AND ps2.is_closed = true
)
AND EXISTS (
  SELECT 1 FROM pipeline_stages ps3
  WHERE ps3.pipeline_id = d.pipeline_id AND ps3.is_closed = true AND ps3.is_won = false
);
