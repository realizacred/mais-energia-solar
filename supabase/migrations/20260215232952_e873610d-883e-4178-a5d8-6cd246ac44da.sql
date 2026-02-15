-- Reset completo dos dados de irradiância para recomeçar do zero
-- 1. Limpar cache de lookup
DELETE FROM irradiance_lookup_cache;

-- 2. Limpar todos os pontos mensais
DELETE FROM irradiance_points_monthly;

-- 3. Limpar versões
DELETE FROM irradiance_dataset_versions;

-- 4. Cancelar jobs de importação pendentes
UPDATE solar_import_jobs 
SET status = 'failed', 
    error_message = 'Reset completo do banco de irradiância',
    finished_at = now()
WHERE status IN ('queued', 'running');

-- 5. Registrar log do reset
INSERT INTO solar_import_job_logs (job_id, tenant_id, level, message)
SELECT id, tenant_id, 'warn', 'Job cancelado por reset completo do banco de irradiância'
FROM solar_import_jobs
WHERE error_message = 'Reset completo do banco de irradiância';