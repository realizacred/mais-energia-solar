
-- ═══════════════════════════════════════════════════════════
-- UNIFY: Align DB integration_providers status with PROVIDER_REGISTRY SSOT
-- This ensures DB mirrors the code registry for all monitoring providers
-- ═══════════════════════════════════════════════════════════

-- ACTIVE providers (real connect + sync implemented)
UPDATE integration_providers SET status = 'available', updated_at = now()
WHERE id IN (
  'solarman_business', 'solis_cloud', 'solaredge', 'deye_cloud',
  'growatt', 'growatt_server', 'livoltek', 'livoltek_cf'
) AND status != 'available';

-- Legacy IDs that map to active providers — mark available too
UPDATE integration_providers SET status = 'available', updated_at = now()
WHERE id IN (
  'goodwe_sems', 'huawei_fusionsolar', 'sungrow_isolarcloud',
  'hoymiles_s_miles', 'foxess', 'sofar_solar', 'fronius', 'saj'
) AND status != 'available';

-- BETA providers (connect works, partial sync)
UPDATE integration_providers SET status = 'available', updated_at = now()
WHERE id IN (
  'enphase', 'kstar', 'apsystems', 'renovigi'
) AND status != 'available';

-- Update credential_schema for providers with legacy IDs in DB
-- so if anything ever reads directly from DB, it gets correct fields

-- GoodWe SEMS (legacy ID in DB: goodwe_sems, canonical: goodwe)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'goodwe_sems';

-- Huawei FusionSolar (legacy: huawei_fusionsolar, canonical: huawei)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "region", "label": "Região do Portal", "type": "select", "placeholder": "Selecione a região", "required": true, "options": [{"value": "la5", "label": "América Latina (la5)"}, {"value": "eu5", "label": "Europa (eu5)"}, {"value": "sg5", "label": "Ásia-Pacífico (sg5)"}, {"value": "au5", "label": "Austrália (au5)"}]},
    {"key": "username", "label": "Usuário de API", "type": "text", "placeholder": "Ex: SolarZAPI", "required": true},
    {"key": "password", "label": "Senha de API", "type": "password", "placeholder": "Senha do usuário de API", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'huawei_fusionsolar';

-- Sungrow iSolarCloud (legacy: sungrow_isolarcloud, canonical: sungrow)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "appId", "label": "App ID", "type": "text", "placeholder": "Seu App ID", "required": true},
    {"key": "appSecret", "label": "App Secret", "type": "password", "placeholder": "Seu App Secret", "required": true},
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'sungrow_isolarcloud';

-- Hoymiles S-Miles (legacy: hoymiles_s_miles, canonical: hoymiles)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "username", "label": "Usuário", "type": "text", "placeholder": "Seu usuário", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'hoymiles_s_miles';

-- FoxESS (legacy: foxess, canonical: fox_ess)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "apiKey", "label": "API Key", "type": "text", "placeholder": "Sua API Key", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'foxess';

-- Sofar Solar (legacy: sofar_solar, canonical: sofar)
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "appId", "label": "App ID", "type": "text", "placeholder": "Seu App ID", "required": true},
    {"key": "appSecret", "label": "App Secret", "type": "password", "placeholder": "Seu App Secret", "required": true},
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'sofar_solar';

-- Fronius
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "apiKey", "label": "API Key", "type": "text", "placeholder": "Sua API Key", "required": true},
    {"key": "systemId", "label": "System ID", "type": "text", "placeholder": "ID do sistema", "required": false}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'fronius';

-- SAJ
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'saj';

-- Deye Cloud
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "region", "label": "Data Center", "type": "select", "placeholder": "Selecione o data center", "required": true, "options": [{"value": "EU", "label": "EMEA"}, {"value": "US", "label": "AMEA"}, {"value": "INDIA", "label": "India"}]},
    {"key": "appId", "label": "App ID", "type": "text", "placeholder": "Seu App ID", "required": true},
    {"key": "appSecret", "label": "App Secret", "type": "password", "placeholder": "Seu App Secret", "required": true},
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'deye_cloud';

-- Enphase
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "apiKey", "label": "API Key", "type": "text", "placeholder": "Sua API Key", "required": true},
    {"key": "clientId", "label": "Client ID", "type": "text", "placeholder": "OAuth Client ID", "required": false},
    {"key": "apiSecret", "label": "API Secret", "type": "password", "placeholder": "Seu API Secret", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'enphase';

-- KStar
UPDATE integration_providers SET 
  credential_schema = '[
    {"key": "email", "label": "E-mail", "type": "email", "placeholder": "seu@email.com", "required": true},
    {"key": "password", "label": "Senha", "type": "password", "placeholder": "Senha", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'kstar';
