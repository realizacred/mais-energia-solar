-- Limpar TODOS os dados brutos do SolarMarket
-- Ordem: folhas → raízes (FKs)

DELETE FROM solar_market_custom_field_values;
DELETE FROM solar_market_funnel_stages;
DELETE FROM solar_market_funnels;
DELETE FROM solar_market_custom_fields;
DELETE FROM solar_market_proposals;
DELETE FROM solar_market_projects;
DELETE FROM solar_market_clients;
DELETE FROM solar_market_sync_logs;
DELETE FROM sm_migration_log;