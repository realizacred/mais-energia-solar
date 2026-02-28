
-- Limpar dados SolarMarket na ordem correta (respeitando FKs)
DELETE FROM solar_market_proposals WHERE 1=1;
DELETE FROM solar_market_projects WHERE 1=1;
DELETE FROM solar_market_custom_field_values WHERE 1=1;
DELETE FROM solar_market_custom_fields WHERE 1=1;
DELETE FROM solar_market_funnel_stages WHERE 1=1;
DELETE FROM solar_market_funnels WHERE 1=1;
DELETE FROM solar_market_clients WHERE 1=1;
DELETE FROM solar_market_sync_logs WHERE 1=1;
DELETE FROM solar_import_job_logs WHERE 1=1;
DELETE FROM solar_import_jobs WHERE 1=1;
