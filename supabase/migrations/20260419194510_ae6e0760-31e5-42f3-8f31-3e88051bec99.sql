-- =========================================================
-- LIMPEZA TOTAL DA ÁREA DE MIGRAÇÃO SOLARMARKET
-- =========================================================

-- 1) Remover cron jobs exclusivos
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('solarmarket-auto-sync', 'solarmarket-proposals-sync', 'migration-watchdog');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2) Apagar dados já migrados das tabelas nativas (import_source = 'solar_market')
DELETE FROM propostas_nativas WHERE import_source = 'solar_market';
DELETE FROM projetos          WHERE import_source = 'solar_market';
DELETE FROM deals             WHERE import_source = 'solar_market';
DELETE FROM clientes          WHERE import_source = 'solar_market';

-- 3) Drop view dependente
DROP VIEW IF EXISTS public.sm_analytics_view CASCADE;

-- 4) Drop tabelas de staging / controle / classificação / mapeamento
DROP TABLE IF EXISTS public.sm_migration_log                    CASCADE;
DROP TABLE IF EXISTS public.sm_migration_settings               CASCADE;
DROP TABLE IF EXISTS public.sm_operation_runs                   CASCADE;
DROP TABLE IF EXISTS public.sm_classification_v2                CASCADE;
DROP TABLE IF EXISTS public.sm_project_classification_old_backup CASCADE;
DROP TABLE IF EXISTS public.sm_consultor_mapping                CASCADE;
DROP TABLE IF EXISTS public.migration_records                   CASCADE;
DROP TABLE IF EXISTS public.migration_jobs                      CASCADE;
DROP TABLE IF EXISTS public.solar_market_custom_field_values    CASCADE;
DROP TABLE IF EXISTS public.solar_market_custom_fields_snapshots CASCADE;
DROP TABLE IF EXISTS public.solar_market_custom_fields          CASCADE;
DROP TABLE IF EXISTS public.solar_market_funnel_stages          CASCADE;
DROP TABLE IF EXISTS public.solar_market_funnels                CASCADE;
DROP TABLE IF EXISTS public.solar_market_proposals              CASCADE;
DROP TABLE IF EXISTS public.solar_market_projects               CASCADE;
DROP TABLE IF EXISTS public.solar_market_clients                CASCADE;
DROP TABLE IF EXISTS public.solar_market_sync_logs              CASCADE;
DROP TABLE IF EXISTS public.solar_market_config                 CASCADE;
DROP TABLE IF EXISTS public.propostas_sm_legado                 CASCADE;
DROP TABLE IF EXISTS public.backup_delete_clientes_teste        CASCADE;
DROP TABLE IF EXISTS public.backup_delete_projetos_teste        CASCADE;
DROP TABLE IF EXISTS public.backup_delete_propostas_teste       CASCADE;

-- 5) Drop colunas auxiliares SM em tabelas nativas
ALTER TABLE public.clientes         DROP COLUMN IF EXISTS sm_client_id;
ALTER TABLE public.clientes         DROP COLUMN IF EXISTS import_source;
ALTER TABLE public.projetos         DROP COLUMN IF EXISTS sm_project_id;
ALTER TABLE public.projetos         DROP COLUMN IF EXISTS import_source;
ALTER TABLE public.propostas_nativas DROP COLUMN IF EXISTS sm_id;
ALTER TABLE public.propostas_nativas DROP COLUMN IF EXISTS sm_project_id;
ALTER TABLE public.propostas_nativas DROP COLUMN IF EXISTS sm_raw_payload;
ALTER TABLE public.propostas_nativas DROP COLUMN IF EXISTS import_source;
ALTER TABLE public.deals            DROP COLUMN IF EXISTS import_source;
ALTER TABLE public.lead_links       DROP COLUMN IF EXISTS sm_client_id;
ALTER TABLE public.lead_links       DROP COLUMN IF EXISTS sm_project_id;

-- 6) Drop funções SECURITY DEFINER auxiliares da migração SolarMarket
DROP FUNCTION IF EXISTS public.acquire_sm_operation_lock           CASCADE;
DROP FUNCTION IF EXISTS public.dry_run_sm_migration                CASCADE;
DROP FUNCTION IF EXISTS public.expire_stale_sm_operations          CASCADE;
DROP FUNCTION IF EXISTS public.fail_stalled_migration_jobs         CASCADE;
DROP FUNCTION IF EXISTS public.has_active_sm_operation             CASCADE;
DROP FUNCTION IF EXISTS public.release_sm_operation_lock           CASCADE;
DROP FUNCTION IF EXISTS public.sm_classify_funnel_stage(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.sm_classify_funnel_stage(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.sm_classify_funnel_stage(text)      CASCADE;
DROP FUNCTION IF EXISTS public.sm_ensure_canonical_pipelines       CASCADE;
DROP FUNCTION IF EXISTS public.sm_match_clients_to_leads           CASCADE;
DROP FUNCTION IF EXISTS public.sm_migration_apply                  CASCADE;
DROP FUNCTION IF EXISTS public.sm_migration_dry_run                CASCADE;
DROP FUNCTION IF EXISTS public.sm_phone_is_valid                   CASCADE;
DROP FUNCTION IF EXISTS public.sm_resolve_or_create_cliente        CASCADE;
DROP FUNCTION IF EXISTS public.tg_sm_classification_bump_version   CASCADE;
DROP FUNCTION IF EXISTS public.tg_sm_classification_updated_at     CASCADE;
DROP FUNCTION IF EXISTS public.update_sm_operation_heartbeat       CASCADE;
DROP FUNCTION IF EXISTS public.validate_sm_migration_integrity     CASCADE;