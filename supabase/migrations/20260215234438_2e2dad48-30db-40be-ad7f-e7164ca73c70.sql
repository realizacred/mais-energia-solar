-- Reset completo: limpar TUDO relacionado a irradiância
DELETE FROM irradiance_lookup_cache;
DELETE FROM irradiance_points_monthly;
DELETE FROM irradiance_dataset_versions;
DELETE FROM solar_import_job_logs;
DELETE FROM solar_import_jobs;