-- ══════════════════════════════════════════════════════════
-- AUDIT: Fix credential_schema for all monitoring providers
-- Based on official API documentation research
-- ══════════════════════════════════════════════════════════

-- 1. Solplanet / AISWEI — needs AppKey, AppSecret, ApiKey (inverter), Token (Pro)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'solplanet', 'monitoring', 'Solplanet (AISWEI)',
  'Monitoramento via AISWEI Cloud API com AppKey, AppSecret e ApiKey do inversor',
  'credentials',
  '[
    {"key": "appKey", "label": "App Key", "placeholder": "Ex: 123456789xxxxx", "type": "text", "required": true, "helperText": "Encontre em Conta > Configurações de Segurança > Código de autorização API"},
    {"key": "appSecret", "label": "App Secret", "placeholder": "Seu App Secret", "type": "password", "required": true},
    {"key": "apiKey", "label": "Api Key (do Inversor)", "placeholder": "Chave API do inversor (em Detalhes da planta)", "type": "text", "required": true},
    {"key": "token", "label": "Token (Pro)", "placeholder": "Token recebido por e-mail (opcional para Consumer)", "type": "password", "required": false, "helperText": "Necessário para API Pro. Solicite via solplanet.net"}
  ]'::jsonb,
  'available', 55,
  '{"steps": ["Acesse o portal AISWEI Cloud (Business ou Consumer)", "Vá em Conta > Configurações de Segurança > Código de autorização API", "Copie o App Key e App Secret", "Obtenha o Api Key do inversor em Detalhes da planta", "Para API Pro: solicite o Token via e-mail para solplanet.net"], "notes": "A URL da API é https://api.general.aisweicloud.com. Os parâmetros na URL devem estar em ordem alfabética e assinados com o AppSecret."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 2. WEG Solar / SunWEG — needs API Key + API Secret (from portal solarportal.weg.net)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'weg_iot', 'monitoring', 'WEG Solar',
  'Monitoramento via WEG Solar Portal com API Key e API Secret',
  'credentials',
  '[
    {"key": "apiKey", "label": "API Key", "placeholder": "Sua API Key do portal WEG Solar", "type": "text", "required": true},
    {"key": "apiSecret", "label": "API Secret", "placeholder": "Seu API Secret", "type": "password", "required": true}
  ]'::jsonb,
  'available', 60,
  '{"steps": ["Acesse o portal WEG Solar: https://solarportal.weg.net/", "No menu lateral, clique em Gestão de API", "Crie uma nova chave de API", "Copie a API Key e o API Secret (exibidos apenas uma vez!)"], "notes": "Apenas plantas nas quais o usuário possui perfil de administrador estarão disponíveis."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 3. Sunweg — same platform as WEG, uses X-Auth-Token from browser
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'sunweg', 'monitoring', 'SunWEG',
  'Monitoramento via plataforma SunWEG.net com token de autenticação',
  'credentials',
  '[
    {"key": "token", "label": "Token de Acesso (X-Auth-Token)", "placeholder": "Token obtido do navegador", "type": "password", "required": true, "helperText": "Obtenha via DevTools do navegador (F12 > Network > cabeçalho X-Auth-Token-Update)"}
  ]'::jsonb,
  'available', 45,
  '{"steps": ["Acesse https://www.sunweg.net e faça login", "Abra DevTools (F12) > aba Network", "Marque Preserve Log e faça login novamente", "Copie o valor do cabeçalho X-Auth-Token-Update de qualquer requisição XHR"], "notes": "O token pode expirar. Se parar de funcionar, gere um novo seguindo os passos acima."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 4. Renovigi — uses ShineMonitor platform (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'renovigi', 'monitoring', 'Renovigi (ShineMonitor)',
  'Monitoramento via portal Renovigi ShineMonitor com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário ShineMonitor", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 50,
  '{"steps": ["Acesse https://renovigi.shinemonitor.com/", "Use seu usuário e senha do portal", "Cole as credenciais no formulário acima"], "notes": "Renovigi utiliza a plataforma ShineMonitor para monitoramento."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 5. PHB Solar — uses ShineMonitor/SolarView portal (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'phb_solar', 'monitoring', 'PHB Solar',
  'Monitoramento via portal PHB Solar com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário do portal PHB", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 45,
  '{"steps": ["Acesse o portal de monitoramento PHB Solar: https://www.phbsolar.com.br/", "Use seu usuário e senha do portal", "Cole as credenciais no formulário acima"], "notes": "PHB Solar utiliza portal próprio baseado em ShineMonitor."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 6. Sungrow iSolarCloud — needs appKey + email/username + password
-- (API v2: https://developer-api.isolarcloud.com)
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "appKey", "label": "App Key (App ID)", "placeholder": "Ex: B0455FBE7AA0328DB57B3", "type": "text", "required": true, "helperText": "Obtido no portal iSolarCloud em Configurações > API"},
    {"key": "email", "label": "E-mail ou Usuário", "placeholder": "seu@email.com", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha iSolarCloud", "type": "password", "required": true}
  ]'::jsonb,
  description = 'Monitoramento via iSolarCloud API com App Key e credenciais',
  tutorial = '{"steps": ["Acesse o portal iSolarCloud: https://www.isolarcloud.com/", "Vá em Configurações > API para obter o App Key", "Use seu e-mail e senha do portal", "Cole no formulário acima"], "notes": "A API v2 requer App Key. A senha é enviada como está (o servidor faz o hash)."}'::jsonb,
  updated_at = now()
WHERE id = 'sungrow_isolarcloud';

-- 7. Victron Energy VRM — needs email + password (not just token)
-- Token can be obtained programmatically via login
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "email", "label": "E-mail VRM", "placeholder": "seu@email.com", "type": "email", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Senha do VRM Portal", "type": "password", "required": true}
  ]'::jsonb,
  description = 'Monitoramento via Victron VRM Portal com e-mail e senha',
  tutorial = '{"steps": ["Acesse https://vrm.victronenergy.com/", "Use seu e-mail e senha do portal VRM", "O sistema obtém o token automaticamente via API"], "notes": "Alternativa: forneça apenas o Access Token se preferir (Configurações > API)."}'::jsonb,
  updated_at = now()
WHERE id = 'victron';

-- 8. GoodWe SEMS — correct (email + password), just add tutorial
UPDATE integration_providers SET
  tutorial = '{"steps": ["Acesse https://www.semsportal.com/", "Use seu e-mail e senha do portal SEMS", "Cole no formulário acima"], "notes": "GoodWe usa o portal SEMS para monitoramento."}'::jsonb,
  updated_at = now()
WHERE id = 'goodwe_sems';

-- 9. Canadian Solar / CSI — needs tokenId (from portal)
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "tokenId", "label": "Token ID", "placeholder": "Seu Token ID do portal CSI", "type": "password", "required": true, "helperText": "Obtido no menu Serviço > API do portal CSI CloudPro"}
  ]'::jsonb,
  description = 'Monitoramento via CSI CloudPro / Smart Energy com Token ID',
  tutorial = '{"steps": ["Acesse o portal CSI CloudPro ou Smart Energy", "Vá em Serviço > API para obter o Token ID", "Cole o Token ID no formulário acima"], "notes": "O Token ID é a única credencial necessária para acessar a API."}'::jsonb,
  updated_at = now()
WHERE id = 'canadian_solar';

-- 10. Trina Solar — placeholder, no public API known
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário TrinaTracker", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'trina_solar';

-- 11. BYD Battery Monitor — placeholder, portal-based
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário BYD", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'byd';

-- 12. Chint Power — placeholder, portal-based
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário Chint/CPS", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'chint';

-- 13. Enphase — needs apiKey + clientId + apiSecret (OAuth2-like)
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "clientId", "label": "Client ID (App ID)", "placeholder": "Seu Client ID do Developer Portal", "type": "text", "required": true},
    {"key": "apiSecret", "label": "Client Secret", "placeholder": "Seu Client Secret", "type": "password", "required": true},
    {"key": "apiKey", "label": "API Key", "placeholder": "Sua API Key do Enlighten", "type": "text", "required": true}
  ]'::jsonb,
  description = 'Monitoramento via Enphase Enlighten API com Client ID, Secret e API Key',
  tutorial = '{"steps": ["Acesse https://developer.enphase.com/", "Registre sua aplicação para obter Client ID e Secret", "Obtenha a API Key em Settings", "Cole todas as credenciais no formulário acima"], "notes": "Enphase usa OAuth2. Após conectar, será necessário autorizar o acesso via redirect."}'::jsonb,
  auth_type = 'oauth2',
  updated_at = now()
WHERE id = 'enphase';

-- 14. SolaX Cloud — needs tokenId only (from portal Service > API)
UPDATE integration_providers SET
  tutorial = '{"steps": ["Acesse https://www.solaxcloud.com/", "Vá em Serviço > API para obter o Token ID", "Cole no formulário acima"], "notes": "O Token ID é gratuito. Frequência máxima: 10 requisições/min e 10.000/dia."}'::jsonb,
  credential_schema = '[
    {"key": "apiKey", "label": "Token ID", "placeholder": "Seu Token ID do SolaX Cloud", "type": "password", "required": true, "helperText": "Obtido no menu Serviço > API do portal SolaX Cloud"}
  ]'::jsonb,
  updated_at = now()
WHERE id = 'solax';

-- 15. Fronius Solar.web — needs apiKey + systemId
UPDATE integration_providers SET
  credential_schema = '[
    {"key": "apiKey", "label": "API Key", "placeholder": "Sua API Key Fronius Solar.web", "type": "password", "required": true},
    {"key": "systemId", "label": "System ID", "placeholder": "ID do sistema (encontrado na URL do Solar.web)", "type": "text", "required": false, "helperText": "Opcional: se não informado, lista todas as plantas"}
  ]'::jsonb,
  tutorial = '{"steps": ["Acesse https://www.solarweb.com/", "Vá em Configurações > API para obter a chave", "Cole no formulário acima"], "notes": "A Fronius Solar.web API usa API Key para autenticação."}'::jsonb,
  updated_at = now()
WHERE id = 'fronius';

-- 16. FoxESS Cloud — needs apiKey (from portal)
UPDATE integration_providers SET
  tutorial = '{"steps": ["Acesse https://www.foxesscloud.com/", "Vá em Configurações > API para gerar a API Key", "Cole no formulário acima"], "notes": "A API Key FoxESS tem limite de requisições. Use com moderação."}'::jsonb,
  updated_at = now()
WHERE id = 'foxess';

-- 17. SMA Sunny Portal — needs api_key
UPDATE integration_providers SET
  tutorial = '{"steps": ["Acesse https://www.sunnyportal.com/", "Vá em Configurações do Sistema > API", "Gere ou copie a API Key", "Cole no formulário acima"], "notes": "A SMA Sunny Portal API requer uma chave gerada no portal."}'::jsonb,
  updated_at = now()
WHERE id = 'sma';

-- 18. ABB/FIMER Aurora Vision — needs api_key
UPDATE integration_providers SET
  tutorial = '{"steps": ["Acesse o portal Aurora Vision", "Vá em Configurações > API", "Copie a API Key", "Cole no formulário acima"], "notes": "ABB/FIMER usa Aurora Vision para monitoramento."}'::jsonb,
  updated_at = now()
WHERE id = 'abb_fimer';

-- 19. Solarman Smart — uses Solarman platform (appId + appSecret + email + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'solarman_smart', 'monitoring', 'Solarman Smart',
  'Monitoramento via Solarman Smart com App ID, App Secret e credenciais',
  'credentials',
  '[
    {"key": "appId", "label": "App ID", "placeholder": "Seu App ID do Solarman", "type": "text", "required": true},
    {"key": "appSecret", "label": "App Secret", "placeholder": "Seu App Secret", "type": "password", "required": true},
    {"key": "email", "label": "E-mail", "placeholder": "seu@email.com", "type": "email", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha do Solarman", "type": "password", "required": true}
  ]'::jsonb,
  'available', 55,
  '{"steps": ["Acesse https://home.solarmanpv.com/", "Vá em Configurações > API para obter App ID e App Secret", "Use seu e-mail e senha do portal", "Cole no formulário acima"], "notes": "Solarman Smart usa a mesma plataforma do Solarman Business."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 20. Elgin Solar — uses Solis Cloud platform underneath (same auth)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'elgin', 'monitoring', 'Elgin Solar',
  'Monitoramento via plataforma Elgin (baseada em SolisCloud) com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário Elgin", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 45,
  '{"steps": ["Acesse o portal de monitoramento Elgin", "Use seu usuário e senha", "Cole no formulário acima"], "notes": "A plataforma Elgin utiliza infraestrutura SolisCloud."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 21. Chint Flexom — portal (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'chint_flexom', 'monitoring', 'Chint Flexom',
  'Monitoramento via portal Chint Flexom com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário Flexom", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 40,
  '{"steps": ["Acesse o portal Chint Flexom", "Use seu usuário e senha", "Cole no formulário acima"], "notes": "Chint Flexom usa portal próprio para monitoramento."}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 22. SolarView — portal (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'solarview', 'monitoring', 'SolarView',
  'Monitoramento via portal SolarView com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário SolarView", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 40,
  '{"steps": ["Acesse o portal SolarView", "Use seu usuário e senha", "Cole no formulário acima"], "notes": null}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 23. EleKeeper — portal (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'elekeeper', 'monitoring', 'EleKeeper',
  'Monitoramento via portal EleKeeper com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário EleKeeper", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 35,
  '{"steps": ["Acesse o portal EleKeeper", "Use seu usuário e senha", "Cole no formulário acima"], "notes": null}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  label = EXCLUDED.label,
  updated_at = now();

-- 24. Kehua — portal (username + password)
INSERT INTO integration_providers (id, category, label, description, auth_type, credential_schema, status, popularity, tutorial)
VALUES (
  'kehua', 'monitoring', 'Kehua Solar',
  'Monitoramento via portal Kehua com usuário e senha',
  'credentials',
  '[
    {"key": "username", "label": "Usuário", "placeholder": "Seu usuário Kehua", "type": "text", "required": true},
    {"key": "password", "label": "Senha", "placeholder": "Sua senha", "type": "password", "required": true}
  ]'::jsonb,
  'available', 30,
  '{"steps": ["Acesse o portal Kehua Solar", "Use seu usuário e senha", "Cole no formulário acima"], "notes": null}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  credential_schema = EXCLUDED.credential_schema,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  updated_at = now();