-- Fix tariff values that were incorrectly stored in R$/MWh instead of R$/kWh
-- Divide all synced values by 1000 to correct the unit

UPDATE concessionarias SET tarifa_energia = ROUND(tarifa_energia / 1000.0, 4) WHERE ultima_sync_tarifas IS NOT NULL AND tarifa_energia > 10;