-- Limpar TODOS os dados de sincronização SolarMarket para começar do zero
-- Preserva: solar_market_config (configuração de conexão)
-- Preserva: solar_market_funnels_catalog e solar_market_custom_fields_catalog (serão re-sincronizados)

TRUNCATE TABLE solar_market_clients CASCADE;
TRUNCATE TABLE solar_market_projects CASCADE;
TRUNCATE TABLE solar_market_proposals CASCADE;
TRUNCATE TABLE solar_market_funnels CASCADE;
TRUNCATE TABLE solar_market_custom_fields CASCADE;
TRUNCATE TABLE solar_market_users CASCADE;
TRUNCATE TABLE solar_market_sync_logs CASCADE;
TRUNCATE TABLE solar_market_sync_items_failed CASCADE;
TRUNCATE TABLE solar_market_integration_requests CASCADE;
TRUNCATE TABLE solar_market_webhook_events CASCADE;
TRUNCATE TABLE solar_market_funnels_catalog CASCADE;
TRUNCATE TABLE solar_market_custom_fields_catalog CASCADE;

-- Resetar timestamps de última sincronização para forçar full sync
UPDATE solar_market_config SET
  last_sync_clients_at = NULL,
  last_sync_projects_at = NULL,
  last_token = NULL,
  last_token_expires_at = NULL;