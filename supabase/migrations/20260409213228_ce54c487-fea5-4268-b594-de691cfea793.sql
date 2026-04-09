
-- Desvincular projetos dos consultores fantasmas
UPDATE projetos SET consultor_id = NULL WHERE consultor_id IN ('c29d032d-db93-4994-b93f-7b2cab7fb8eb', '69afb307-1d3c-4793-8766-0a95da221d84');

-- Deletar consultores fantasmas
DELETE FROM consultores WHERE id IN ('c29d032d-db93-4994-b93f-7b2cab7fb8eb', '69afb307-1d3c-4793-8766-0a95da221d84');
