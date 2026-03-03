-- Fix Huawei plants stuck as "unknown" when they have capacity > 0
-- These are communicating plants that just don't return realHealthState
UPDATE solar_plants
SET status = 'normal', updated_at = now()
WHERE provider = 'huawei_fusionsolar'
  AND status = 'unknown'
  AND capacity_kw > 0;