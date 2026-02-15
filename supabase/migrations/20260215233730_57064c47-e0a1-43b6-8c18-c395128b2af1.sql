-- Limpar logs de jobs antigos
DELETE FROM solar_import_job_logs;

-- Limpar todos os jobs de importação
DELETE FROM solar_import_jobs;