
-- Cleanup failed migration attempt data
DELETE FROM deals WHERE id = '0d4100eb-c598-47f4-a86e-2bcbc90a2303' AND tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM clientes WHERE id = '6cca6c7d-9fa7-4313-8c4d-28df30d9d421' AND tenant_id = '00000000-0000-0000-0000-000000000001';
