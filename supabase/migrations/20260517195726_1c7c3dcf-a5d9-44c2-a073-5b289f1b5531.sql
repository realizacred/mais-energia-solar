CREATE TABLE IF NOT EXISTS public.pipeline_stage_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Fallback, usually linked to tenant system
  stage_id UUID NOT NULL, -- references pipeline_stages or projeto_etapas (agnostic)
  tipo_validacao TEXT NOT NULL,
  configuracao JSONB DEFAULT '{}'::jsonb,
  mensagem_bloqueio TEXT,
  bloquear_avanco BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_stage_validations ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY "tenant_select_validations" ON public.pipeline_stage_validations
  FOR SELECT USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "tenant_insert_validations" ON public.pipeline_stage_validations
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "tenant_update_validations" ON public.pipeline_stage_validations
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "tenant_delete_validations" ON public.pipeline_stage_validations
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Handle updated_at
CREATE TRIGGER update_pipeline_stage_validations_updated_at
  BEFORE UPDATE ON public.pipeline_stage_validations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update tenant_id reference if table exists
DO $$ 
BEGIN
  -- We usually don't reference auth.users directly for tenant_id if there's a dedicated tenants table
  -- but following the project pattern for simplicity. Adjusting constraint if needed.
  ALTER TABLE public.pipeline_stage_validations DROP CONSTRAINT IF EXISTS pipeline_stage_validations_tenant_id_fkey;
END $$;
