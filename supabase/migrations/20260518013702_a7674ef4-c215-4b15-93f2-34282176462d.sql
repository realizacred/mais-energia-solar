-- 1. Consolidate columns in pipeline_automations
UPDATE public.pipeline_automations 
SET 
  projeto_funil_id = COALESCE(projeto_funil_id, funil_projeto_id),
  projeto_etapa_id = COALESCE(projeto_etapa_id, etapa_projeto_id);

ALTER TABLE public.pipeline_automations DROP COLUMN IF EXISTS funil_projeto_id;
ALTER TABLE public.pipeline_automations DROP COLUMN IF EXISTS etapa_projeto_id;

-- 2. Extend notification_rules
ALTER TABLE public.notification_rules 
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.pipeline_automations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS projeto_funil_id uuid REFERENCES public.projeto_funis(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS projeto_etapa_id uuid REFERENCES public.projeto_etapas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Migrate data if any exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'automation_message_templates') THEN
        INSERT INTO public.notification_rules (
          tenant_id, 
          evento, 
          canal, 
          template_mensagem, 
          ativo, 
          metadata, 
          created_at
        )
        SELECT 
          tenant_id,
          gatilho,
          canal,
          template,
          ativo,
          metadata,
          created_at
        FROM public.automation_message_templates
        ON CONFLICT DO NOTHING;
        
        DROP TABLE public.automation_message_templates;
    END IF;
END $$;
