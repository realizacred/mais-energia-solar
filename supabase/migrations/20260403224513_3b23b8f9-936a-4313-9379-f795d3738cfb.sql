
-- Fix orcamentos tenant_id: move from global to real tenant
UPDATE orcamentos
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND lead_id IN (
  SELECT id FROM leads WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
);

-- Remap orcamentos.status_id from global statuses to real tenant statuses
DO $$
DECLARE
  mapping RECORD;
BEGIN
  FOR mapping IN
    SELECT old_s.id AS old_id, new_s.id AS new_id
    FROM lead_status old_s
    JOIN lead_status new_s ON new_s.nome = old_s.nome 
      AND new_s.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    WHERE old_s.tenant_id = '00000000-0000-0000-0000-000000000001'
  LOOP
    UPDATE orcamentos
    SET status_id = mapping.new_id
    WHERE status_id = mapping.old_id
    AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
  END LOOP;
END $$;
