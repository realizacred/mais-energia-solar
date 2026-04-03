
DO $$
DECLARE
  wrong_tid uuid := '00000000-0000-0000-0000-000000000001';
  right_tid uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
BEGIN
  UPDATE solar_market_config SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE integration_configs SET tenant_id = right_tid WHERE tenant_id = wrong_tid AND service_key = 'solarmarket';
  UPDATE solar_market_clients SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_projects SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_proposals SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_funnels SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_funnel_stages SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_sync_logs SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  UPDATE solar_market_custom_fields SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solar_market_custom_field_values') THEN
    UPDATE solar_market_custom_field_values SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solar_market_custom_fields_snapshots') THEN
    UPDATE solar_market_custom_fields_snapshots SET tenant_id = right_tid WHERE tenant_id = wrong_tid;
  END IF;
END $$;
