-- Delete 4 duplicate "Samuel Cruz" proposals created on 2026-03-12
-- Keep only the original from 2026-03-11 (id: e8c0e193-6ec7-4ed5-83c5-8356f8e5d329)

-- First delete versoes (child records)
DELETE FROM proposta_versoes WHERE proposta_id IN (
  '94c84c35-578a-4d89-999d-d8eb8a97b8eb',
  'dd0a9c1a-7b43-4664-8976-e9c7ae930875',
  '578b59ee-d34c-4737-b32a-25341e90bf1f',
  '621fd101-6871-4df2-9d68-c43c44c9c35a'
);

-- Then delete the proposals themselves
DELETE FROM propostas_nativas WHERE id IN (
  '94c84c35-578a-4d89-999d-d8eb8a97b8eb',
  'dd0a9c1a-7b43-4664-8976-e9c7ae930875',
  '578b59ee-d34c-4737-b32a-25341e90bf1f',
  '621fd101-6871-4df2-9d68-c43c44c9c35a'
);