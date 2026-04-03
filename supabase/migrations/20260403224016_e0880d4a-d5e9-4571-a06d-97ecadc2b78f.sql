
-- Step 1: Insert missing statuses into real tenant (skip Arquivado which already exists)
INSERT INTO lead_status (nome, ordem, cor, tenant_id, motivo_perda_obrigatorio)
SELECT nome, ordem, cor, '17de8315-2e2f-4a79-8751-e5d507d69a41', COALESCE(motivo_perda_obrigatorio, false)
FROM lead_status
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
AND nome != 'Arquivado'
ON CONFLICT DO NOTHING;

-- Step 2: Remap leads.status_id from global to real tenant
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
    UPDATE leads 
    SET status_id = mapping.new_id 
    WHERE status_id = mapping.old_id 
    AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
  END LOOP;
END $$;
