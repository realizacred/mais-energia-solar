ALTER TABLE solarmarket_import_jobs 
  ADD COLUMN IF NOT EXISTS total_projeto_funis integer NOT NULL DEFAULT 0;