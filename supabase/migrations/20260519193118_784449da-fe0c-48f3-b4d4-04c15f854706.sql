-- Add SLA configuration to operational stages
ALTER TABLE public.projeto_etapas 
ADD COLUMN IF NOT EXISTS sla_days INTEGER DEFAULT 0;

-- Add tracking for stage entry in projects
ALTER TABLE public.projetos 
ADD COLUMN IF NOT EXISTS data_entrada_etapa TIMESTAMP WITH TIME ZONE;

-- Initialize data_entrada_etapa for existing records
UPDATE public.projetos 
SET data_entrada_etapa = updated_at 
WHERE data_entrada_etapa IS NULL;

-- Function to track stage entry automatically
CREATE OR REPLACE FUNCTION public.track_projeto_stage_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.etapa_id IS DISTINCT FROM NEW.etapa_id) OR (OLD.data_entrada_etapa IS NULL) THEN
    NEW.data_entrada_etapa = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stage entry tracking
DROP TRIGGER IF EXISTS tr_projetos_track_stage_entry ON public.projetos;
CREATE TRIGGER tr_projetos_track_stage_entry
BEFORE UPDATE ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.track_projeto_stage_entry();

-- Index for operational pendencies performance
CREATE INDEX IF NOT EXISTS idx_projeto_pendencias_projeto_id ON public.projeto_pendencias(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_pendencias_tenant_id ON public.projeto_pendencias(tenant_id);
