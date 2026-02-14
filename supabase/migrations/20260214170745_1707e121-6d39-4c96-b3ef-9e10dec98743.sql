
-- ==============================================
-- REMOÇÃO COMPLETA: SolarMarket
-- Auditoria: sem acoplamento restante no frontend
-- ==============================================

-- 1) Drop function that references solar_market tables
DROP FUNCTION IF EXISTS public.cleanup_sm_integration_requests();

-- 2) Drop all solar_market tables (CASCADE handles FKs between them)
DROP TABLE IF EXISTS public.solar_market_webhook_events CASCADE;
DROP TABLE IF EXISTS public.solar_market_sync_items_failed CASCADE;
DROP TABLE IF EXISTS public.solar_market_sync_logs CASCADE;
DROP TABLE IF EXISTS public.solar_market_proposals CASCADE;
DROP TABLE IF EXISTS public.solar_market_projects CASCADE;
DROP TABLE IF EXISTS public.solar_market_integration_requests CASCADE;
DROP TABLE IF EXISTS public.solar_market_funnels_catalog CASCADE;
DROP TABLE IF EXISTS public.solar_market_funnels CASCADE;
DROP TABLE IF EXISTS public.solar_market_custom_fields_catalog CASCADE;
DROP TABLE IF EXISTS public.solar_market_custom_fields CASCADE;
DROP TABLE IF EXISTS public.solar_market_config CASCADE;
DROP TABLE IF EXISTS public.solar_market_clients CASCADE;
DROP TABLE IF EXISTS public.solar_market_users CASCADE;
