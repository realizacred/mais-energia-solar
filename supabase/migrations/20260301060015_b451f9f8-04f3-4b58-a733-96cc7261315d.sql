
INSERT INTO integration_providers (id, category, label, description, logo_key, status, auth_type, credential_schema, tutorial, capabilities, platform_managed_keys, popularity)
VALUES
-- Tier 1: Major brands with full API
('enphase', 'monitoring', 'Enphase', 'Monitoramento de microinversores Enphase via Enlighten API', 'Zap', 'coming_soon', 'oauth2', '[]'::jsonb, '{"steps":["Acesse developer.enphaseenergy.com","Crie um app e obtenha Client ID e Secret","Autorize o acesso via OAuth2"],"notes":"Requer conta de desenvolvedor Enphase."}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true,"sync_alerts":true}'::jsonb, false, 78),

('fronius', 'monitoring', 'Fronius Solar.web', 'Monitoramento de inversores Fronius via Solar.web API', 'Sun', 'coming_soon', 'api_key', '[{"key":"api_key","label":"API Key","type":"password","required":true,"placeholder":"Sua API Key Fronius"}]'::jsonb, '{"steps":["Acesse solarweb.com e faça login","Vá em Configurações > Acesso API","Gere uma chave de API"],"notes":"Disponível para contas Fronius Solar.web Pro."}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 74),

('canadian_solar', 'monitoring', 'Canadian Solar (CSI Monitor)', 'Monitoramento de inversores Canadian Solar', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal CSI Monitor","Solicite acesso à API via suporte"],"notes":"API disponível mediante solicitação."}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 68),

('abb_fimer', 'monitoring', 'ABB / FIMER (Aurora Vision)', 'Monitoramento de inversores ABB/FIMER via Aurora Vision', 'Cpu', 'coming_soon', 'api_key', '[{"key":"api_key","label":"API Key","type":"password","required":true,"placeholder":"Sua API Key Aurora Vision"}]'::jsonb, '{"steps":["Acesse auroravision.net","Vá em Account > API Access","Gere uma chave de API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 66),

('trina_solar', 'monitoring', 'Trina Solar (TrinaTracker)', 'Monitoramento de inversores e trackers Trina Solar', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal TrinaTracker","Solicite credenciais de API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 64),

('apsystems', 'monitoring', 'APsystems (EMA)', 'Monitoramento de microinversores APsystems via EMA', 'Zap', 'coming_soon', 'credentials', '[{"key":"email","label":"E-mail EMA","type":"email","required":true,"placeholder":"seu@email.com"},{"key":"password","label":"Senha","type":"password","required":true}]'::jsonb, '{"steps":["Use suas credenciais do app EMA Manager","E-mail e senha da conta APsystems"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 62),

('byd', 'monitoring', 'BYD Battery Monitor', 'Monitoramento de baterias BYD', 'Gauge', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal BYD Battery-Box","Solicite acesso via distribuidor autorizado"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 58),

('chint', 'monitoring', 'Chint Power (CPS Monitor)', 'Monitoramento de inversores Chint/CPS', 'Cpu', 'coming_soon', 'credentials', '[]'::jsonb, '{"steps":["Acesse o portal CPS Monitor","Use suas credenciais de login"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 56),

('saj', 'monitoring', 'SAJ (eSolar)', 'Monitoramento de inversores SAJ via eSolar', 'Sun', 'coming_soon', 'credentials', '[{"key":"email","label":"E-mail eSolar","type":"email","required":true,"placeholder":"seu@email.com"},{"key":"password","label":"Senha","type":"password","required":true}]'::jsonb, '{"steps":["Use suas credenciais do portal eSolar (esolarcloud.com)","E-mail e senha da conta SAJ"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 54),

('risen', 'monitoring', 'Risen Energy', 'Monitoramento de inversores Risen Energy', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal Risen Energy","Solicite credenciais de API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 50),

('jinko_solar', 'monitoring', 'Jinko Solar (JinkoCloud)', 'Monitoramento de inversores Jinko Solar', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse cloud.jinkosolar.com","Solicite acesso à API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 48),

('ja_solar', 'monitoring', 'JA Solar (JANet)', 'Monitoramento de inversores JA Solar via JANet', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal JANet","Solicite credenciais via suporte JA Solar"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 46),

('longi', 'monitoring', 'LONGi Solar', 'Monitoramento de inversores LONGi Solar', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal LONGi","Solicite acesso à API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 44),

('sma', 'monitoring', 'SMA (Sunny Portal)', 'Monitoramento de inversores SMA via Sunny Portal', 'Sun', 'coming_soon', 'api_key', '[{"key":"api_key","label":"API Key","type":"password","required":true,"placeholder":"Sua API Key SMA"}]'::jsonb, '{"steps":["Acesse sunnyportal.com","Vá em Configurações > API Access","Gere uma chave de API"],"notes":"Disponível para inversores SMA com Sunny Portal."}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true,"sync_alerts":true}'::jsonb, false, 76),

('foxess', 'monitoring', 'FoxESS Cloud', 'Monitoramento de inversores FoxESS', 'Cpu', 'coming_soon', 'api_key', '[{"key":"api_key","label":"API Key","type":"password","required":true,"placeholder":"Sua API Key FoxESS"}]'::jsonb, '{"steps":["Acesse foxesscloud.com","Vá em Perfil > API Management","Gere uma chave de API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 72),

('victron', 'monitoring', 'Victron Energy (VRM)', 'Monitoramento de sistemas Victron via VRM Portal', 'Gauge', 'coming_soon', 'api_key', '[{"key":"token","label":"Access Token","type":"password","required":true,"placeholder":"Seu token VRM"}]'::jsonb, '{"steps":["Acesse vrm.victronenergy.com","Vá em Settings > Access Tokens","Crie um token de acesso"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true,"sync_alerts":true}'::jsonb, false, 70),

('sofar_solar', 'monitoring', 'Sofar Solar (SolarMAN)', 'Monitoramento de inversores Sofar Solar', 'Sun', 'coming_soon', 'credentials', '[{"key":"email","label":"E-mail","type":"email","required":true,"placeholder":"seu@email.com"},{"key":"password","label":"Senha","type":"password","required":true}]'::jsonb, '{"steps":["Use credenciais do portal Sofar/SolarMAN","E-mail e senha da conta Sofar"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 60),

('ingeteam', 'monitoring', 'Ingeteam (INGECON)', 'Monitoramento de inversores Ingeteam', 'Cpu', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal Ingeteam","Solicite acesso à API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 42),

('delta', 'monitoring', 'Delta Electronics (MyDeltaSolar)', 'Monitoramento de inversores Delta', 'Cpu', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse mydeltasolar.deltaww.com","Solicite acesso à API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 40),

('kstar', 'monitoring', 'KStar Solar', 'Monitoramento de inversores KStar', 'Sun', 'coming_soon', 'credentials', '[]'::jsonb, '{"steps":["Acesse o portal KStar","Use credenciais de login"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 38),

('must_solar', 'monitoring', 'Must Solar', 'Monitoramento de inversores Must Solar', 'Sun', 'coming_soon', 'credentials', '[]'::jsonb, '{"steps":["Acesse o portal Must Solar","Use credenciais de login"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 36),

('tsun', 'monitoring', 'TSUN (Talent Solar)', 'Monitoramento de microinversores TSUN', 'Zap', 'coming_soon', 'credentials', '[]'::jsonb, '{"steps":["Acesse o portal TSUN Smart","Use credenciais de login"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true,"sync_devices":true}'::jsonb, false, 34),

('phono_solar', 'monitoring', 'Phono Solar', 'Monitoramento de inversores Phono Solar', 'Sun', 'coming_soon', 'api_key', '[]'::jsonb, '{"steps":["Acesse o portal Phono Solar","Solicite acesso à API"]}'::jsonb, '{"sync_plants":true,"sync_metrics":true}'::jsonb, false, 32)

ON CONFLICT (id) DO NOTHING;
