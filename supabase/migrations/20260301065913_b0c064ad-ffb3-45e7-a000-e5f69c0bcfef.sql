
-- Fix Huawei FusionSolar credential_schema: add region, remove confusing systemCode
UPDATE integration_providers
SET credential_schema = jsonb_build_array(
  jsonb_build_object(
    'key', 'region',
    'label', 'Região do Portal',
    'type', 'select',
    'required', true,
    'options', jsonb_build_array(
      jsonb_build_object('value', 'la5', 'label', 'América Latina (la5)'),
      jsonb_build_object('value', 'eu5', 'label', 'Europa (eu5)'),
      jsonb_build_object('value', 'sg5', 'label', 'Ásia-Pacífico (sg5)'),
      jsonb_build_object('value', 'au5', 'label', 'Austrália (au5)')
    ),
    'helperText', 'Selecione a região do seu portal FusionSolar'
  ),
  jsonb_build_object('key', 'username', 'label', 'Usuário de API', 'type', 'text', 'required', true, 'placeholder', 'Ex: SolarZAPI', 'helperText', 'Usuário criado em Gestão de API (NÃO é o login do portal)'),
  jsonb_build_object('key', 'password', 'label', 'Senha de API', 'type', 'password', 'required', true, 'helperText', 'Senha do usuário de API (usada apenas para gerar token)')
),
updated_at = now()
WHERE id = 'huawei_fusionsolar';
