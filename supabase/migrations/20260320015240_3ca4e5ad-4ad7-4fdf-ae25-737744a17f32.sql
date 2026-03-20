
ALTER TABLE meter_devices ADD COLUMN IF NOT EXISTS leitura_inicial_03 NUMERIC DEFAULT 0;
ALTER TABLE meter_devices ADD COLUMN IF NOT EXISTS leitura_inicial_103 NUMERIC DEFAULT 0;
ALTER TABLE meter_devices ADD COLUMN IF NOT EXISTS leitura_inicial_data DATE;
ALTER TABLE meter_devices ADD COLUMN IF NOT EXISTS leitura_inicial_observacao TEXT;
