
-- ═══════════════════════════════════════════════════════════
-- NORMALIZE: Legacy provider IDs → canonical IDs
-- Then add unique index to prevent future duplicates
-- ═══════════════════════════════════════════════════════════

-- First, delete legacy rows where canonical already exists (duplicates)
DELETE FROM monitoring_integrations
WHERE provider = 'hoymiles_s_miles'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'hoymiles');

DELETE FROM monitoring_integrations
WHERE provider = 'goodwe_sems'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'goodwe');

DELETE FROM monitoring_integrations
WHERE provider = 'huawei_fusionsolar'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'huawei');

DELETE FROM monitoring_integrations
WHERE provider = 'sungrow_isolarcloud'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'sungrow');

DELETE FROM monitoring_integrations
WHERE provider = 'solarman_business_api'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'solarman_business');

DELETE FROM monitoring_integrations
WHERE provider = 'foxess'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'fox_ess');

DELETE FROM monitoring_integrations
WHERE provider = 'sofar_solar'
  AND EXISTS (SELECT 1 FROM monitoring_integrations WHERE provider = 'sofar');

-- Now rename remaining legacy → canonical (where no canonical exists yet)
UPDATE monitoring_integrations SET provider = 'hoymiles' WHERE provider = 'hoymiles_s_miles';
UPDATE monitoring_integrations SET provider = 'goodwe' WHERE provider = 'goodwe_sems';
UPDATE monitoring_integrations SET provider = 'huawei' WHERE provider = 'huawei_fusionsolar';
UPDATE monitoring_integrations SET provider = 'sungrow' WHERE provider = 'sungrow_isolarcloud';
UPDATE monitoring_integrations SET provider = 'solarman_business' WHERE provider = 'solarman_business_api';
UPDATE monitoring_integrations SET provider = 'fox_ess' WHERE provider = 'foxess';
UPDATE monitoring_integrations SET provider = 'sofar' WHERE provider = 'sofar_solar';

-- Also normalize solar_plants provider column
UPDATE solar_plants SET provider = 'hoymiles' WHERE provider = 'hoymiles_s_miles';
UPDATE solar_plants SET provider = 'goodwe' WHERE provider = 'goodwe_sems';
UPDATE solar_plants SET provider = 'huawei' WHERE provider = 'huawei_fusionsolar';
UPDATE solar_plants SET provider = 'sungrow' WHERE provider = 'sungrow_isolarcloud';
UPDATE solar_plants SET provider = 'solarman_business' WHERE provider = 'solarman_business_api';
UPDATE solar_plants SET provider = 'fox_ess' WHERE provider = 'foxess';
UPDATE solar_plants SET provider = 'sofar' WHERE provider = 'sofar_solar';

-- Unique index per tenant+provider to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_integrations_tenant_provider_uniq
ON monitoring_integrations (tenant_id, provider);
