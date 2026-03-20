-- Remove leituras com dados incorretos (parsing Base64 como hex)
DELETE FROM public.meter_readings 
WHERE voltage_v = 1.1 AND current_a = 43.69 AND power_w = 2730;

-- Atualizar meter_status_latest para refletir última leitura correta
UPDATE public.meter_status_latest 
SET voltage_v = NULL, current_a = NULL, power_w = NULL
WHERE voltage_v = 1.1 AND current_a = 43.69;