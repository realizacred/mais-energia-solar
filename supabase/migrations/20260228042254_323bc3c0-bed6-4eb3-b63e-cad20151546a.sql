-- Clean up orphaned records from failed migration (Daniella instead of Walter Cesar)

-- 1. Delete deal_pipeline_stages for the orphan deal
DELETE FROM deal_pipeline_stages WHERE deal_id = '9d39e1ab-9818-4ae8-abb6-ef289cb4f7e2';

-- 2. Delete the orphan projeto
DELETE FROM projetos WHERE id = 'f24b0c81-2a03-4e7a-97c0-363a86411b10';

-- 3. Delete the orphan deal
DELETE FROM deals WHERE id = '9d39e1ab-9818-4ae8-abb6-ef289cb4f7e2';

-- 4. Delete the orphan cliente (Daniella created by migration error)
DELETE FROM clientes WHERE id = '13c3c943-8ea2-4529-b7bc-6497a7a73239';