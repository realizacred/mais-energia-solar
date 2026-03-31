UPDATE integration_providers
SET credential_schema = '[{"key":"token","label":"Token de acesso","type":"password","required":true,"placeholder":"Cole aqui o token fornecido pela JNG/Solaryum"}]'::jsonb
WHERE id = 'jng';