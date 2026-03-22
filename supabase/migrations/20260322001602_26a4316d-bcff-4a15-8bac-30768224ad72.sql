-- View: daily aggregated meter readings (last reading per day, with daily consumption/injection delta)
CREATE OR REPLACE VIEW public.meter_readings_daily AS
WITH ranked AS (
  SELECT
    mr.*,
    (mr.measured_at AT TIME ZONE 'America/Sao_Paulo')::date AS reading_date,
    ROW_NUMBER() OVER (
      PARTITION BY mr.meter_device_id, (mr.measured_at AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY mr.measured_at DESC
    ) AS rn_last,
    ROW_NUMBER() OVER (
      PARTITION BY mr.meter_device_id, (mr.measured_at AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY mr.measured_at ASC
    ) AS rn_first
  FROM public.meter_readings mr
),
daily AS (
  SELECT
    meter_device_id,
    reading_date,
    MAX(CASE WHEN rn_last = 1 THEN id::text END)::uuid AS id,
    MAX(CASE WHEN rn_last = 1 THEN tenant_id::text END)::uuid AS tenant_id,
    MAX(CASE WHEN rn_last = 1 THEN measured_at END) AS measured_at,
    MAX(CASE WHEN rn_last = 1 THEN energy_import_kwh END) AS energy_import_kwh_end,
    MAX(CASE WHEN rn_first = 1 THEN energy_import_kwh END) AS energy_import_kwh_start,
    MAX(CASE WHEN rn_last = 1 THEN energy_export_kwh END) AS energy_export_kwh_end,
    MAX(CASE WHEN rn_first = 1 THEN energy_export_kwh END) AS energy_export_kwh_start,
    MAX(CASE WHEN rn_last = 1 THEN voltage_v END) AS voltage_v,
    MAX(CASE WHEN rn_last = 1 THEN power_w END) AS power_w,
    COUNT(*) AS readings_count
  FROM ranked
  GROUP BY meter_device_id, reading_date
)
SELECT
  id,
  tenant_id,
  meter_device_id,
  reading_date,
  measured_at,
  COALESCE(energy_import_kwh_end - energy_import_kwh_start, 0) AS consumo_dia_kwh,
  COALESCE(energy_export_kwh_end - energy_export_kwh_start, 0) AS injecao_dia_kwh,
  energy_import_kwh_end AS energy_import_kwh,
  energy_export_kwh_end AS energy_export_kwh,
  voltage_v,
  power_w,
  readings_count
FROM daily;