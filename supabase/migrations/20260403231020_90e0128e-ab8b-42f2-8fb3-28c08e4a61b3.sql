
-- Remove invented HTML web templates that don't belong to the user
DELETE FROM proposta_templates 
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND tipo = 'html'
AND id IN (
  'c257f876-49da-4e5c-96aa-b9124a8194ea',
  '6ffa3f12-cc35-4d45-9e72-3c95a1755f88',
  '486b7e3e-2679-4d73-a1cb-59a74177e176'
);
