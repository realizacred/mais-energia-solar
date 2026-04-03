DO $$
DECLARE
  mapping RECORD;
BEGIN
  -- Build mapping and update all FKs
  FOR mapping IN
    SELECT c_bad.id AS old_id, c_good.id AS new_id
    FROM consultores c_bad
    JOIN consultores c_good ON c_good.nome = c_bad.nome 
      AND c_good.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    WHERE c_bad.tenant_id = '00000000-0000-0000-0000-000000000001'
  LOOP
    UPDATE leads SET consultor_id = mapping.new_id WHERE consultor_id = mapping.old_id;
    UPDATE orcamentos SET consultor_id = mapping.new_id WHERE consultor_id = mapping.old_id;
    UPDATE wa_instances SET consultor_id = mapping.new_id WHERE consultor_id = mapping.old_id;
    UPDATE wa_instance_consultores SET consultor_id = mapping.new_id WHERE consultor_id = mapping.old_id;
  END LOOP;

  -- Delete orphaned child records
  DELETE FROM meta_notifications WHERE consultor_id IN (SELECT id FROM consultores WHERE tenant_id = '00000000-0000-0000-0000-000000000001');
  DELETE FROM consultor_metas WHERE consultor_id IN (SELECT id FROM consultores WHERE tenant_id = '00000000-0000-0000-0000-000000000001');

  -- Delete duplicate consultores
  DELETE FROM consultores WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
END $$;