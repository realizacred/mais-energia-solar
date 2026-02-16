
-- Limpar pontos da versão atual (1.430 pontos grosseiros de 1°)
DELETE FROM irradiance_points_monthly 
WHERE version_id = 'f8342045-96f9-4d30-b40a-a55d601d09e7';

-- Limpar cache (já está vazio mas por segurança)
DELETE FROM irradiance_lookup_cache 
WHERE version_id = 'f8342045-96f9-4d30-b40a-a55d601d09e7';

-- Deletar a versão
DELETE FROM irradiance_dataset_versions 
WHERE id = 'f8342045-96f9-4d30-b40a-a55d601d09e7';
