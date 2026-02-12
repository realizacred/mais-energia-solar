
-- Limpar dados espelhados do SolarMarket para re-sync limpa
TRUNCATE TABLE solar_market_proposals CASCADE;
TRUNCATE TABLE solar_market_custom_fields CASCADE;
TRUNCATE TABLE solar_market_funnels CASCADE;
TRUNCATE TABLE solar_market_projects CASCADE;
TRUNCATE TABLE solar_market_clients CASCADE;
TRUNCATE TABLE solar_market_users CASCADE;
TRUNCATE TABLE solar_market_sync_logs CASCADE;
TRUNCATE TABLE solar_market_sync_items_failed CASCADE;
TRUNCATE TABLE solar_market_integration_requests CASCADE;
TRUNCATE TABLE lead_links CASCADE;

-- Resetar timestamps para forçar sync completa
UPDATE solar_market_config 
SET last_sync_clients_at = NULL, 
    last_sync_projects_at = NULL,
    last_token = NULL,
    last_token_expires_at = NULL;
