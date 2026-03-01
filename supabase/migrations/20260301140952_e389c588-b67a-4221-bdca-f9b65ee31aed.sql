-- Fix growatt_server category from 'Monitoramento Solar' to 'monitoring' so it gets filtered correctly
UPDATE integration_providers SET category = 'monitoring' WHERE id = 'growatt_server' AND category = 'Monitoramento Solar';

-- Update DB monitoring providers statuses to match reality (PROVIDER_REGISTRY is SSOT)
-- These entries are filtered out by the catalog page (L71) but keeping them accurate prevents confusion
UPDATE integration_providers SET status = 'coming_soon' WHERE id IN ('elekeeper','elgin','kehua','livoltek','livoltek_cf','phb_solar','renovigi','solarman_smart','solarview','solplanet','sunweg','weg_iot','chint_flexom') AND category = 'monitoring';
