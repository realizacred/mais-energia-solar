
-- Reset total de todas as tabelas SolarMarket
-- Ordem: primeiro tabelas dependentes, depois as principais

TRUNCATE TABLE solar_market_custom_field_values CASCADE;
TRUNCATE TABLE solar_market_custom_fields_snapshots CASCADE;
TRUNCATE TABLE solar_market_custom_fields CASCADE;
TRUNCATE TABLE solar_market_proposals CASCADE;
TRUNCATE TABLE solar_market_projects CASCADE;
TRUNCATE TABLE solar_market_funnel_stages CASCADE;
TRUNCATE TABLE solar_market_funnels CASCADE;
TRUNCATE TABLE solar_market_clients CASCADE;
TRUNCATE TABLE solar_market_sync_logs CASCADE;
