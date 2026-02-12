
-- Reset all SolarMarket sync data for fresh extraction
TRUNCATE TABLE solar_market_proposals CASCADE;
TRUNCATE TABLE solar_market_funnels CASCADE;
TRUNCATE TABLE solar_market_custom_fields CASCADE;
TRUNCATE TABLE solar_market_clients CASCADE;
TRUNCATE TABLE solar_market_projects CASCADE;
TRUNCATE TABLE solar_market_users CASCADE;
TRUNCATE TABLE solar_market_sync_items_failed CASCADE;
TRUNCATE TABLE solar_market_sync_logs CASCADE;
TRUNCATE TABLE solar_market_webhook_events CASCADE;
