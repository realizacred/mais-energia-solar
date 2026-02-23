-- Fix cross-tenant status_id reference for Igor and Bruno
-- They belong to tenant 00000000-... but point to Arquivado of tenant 17de8315-...
-- Correct Arquivado for tenant 00000000-... is c2d67200-d88e-4bc5-9967-7f7f5288734f
UPDATE leads 
SET status_id = 'c2d67200-d88e-4bc5-9967-7f7f5288734f'
WHERE id IN ('f9ef8c5d-ea43-45a9-a39c-108d07076511', '97a8e1c5-22c6-426f-9d78-2f9789e150f5')
AND status_id = '5f2070fa-de45-4975-8a52-64a24f603067';