UPDATE integration_providers
SET credential_schema = '[{"key":"token","label":"Token de acesso","type":"password","required":true,"placeholder":"Cole aqui o token fornecido pela JNG/Solaryum"},{"key":"ibge","label":"Código IBGE da cidade","type":"text","required":true,"placeholder":"Ex: 3550308 (São Paulo)"}]'::jsonb
WHERE id = 'jng';