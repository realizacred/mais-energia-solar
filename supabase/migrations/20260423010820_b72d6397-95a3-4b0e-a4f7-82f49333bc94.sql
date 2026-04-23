-- Subfase 2.1: adicionar coluna 'role' à tabela de mapeamento de funis
-- Permite que um funil SM seja: pipeline / vendedor_source / tag / ignore
ALTER TABLE public.sm_funil_pipeline_map
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'pipeline'
    CHECK (role IN ('pipeline', 'vendedor_source', 'tag', 'ignore'));

-- pipeline_id é obrigatório apenas quando role = 'pipeline'
ALTER TABLE public.sm_funil_pipeline_map
  ALTER COLUMN pipeline_id DROP NOT NULL;

-- Garantir consistência: se role='pipeline', pipeline_id deve estar preenchido
ALTER TABLE public.sm_funil_pipeline_map
  DROP CONSTRAINT IF EXISTS sm_funil_pipeline_map_role_pipeline_check;
ALTER TABLE public.sm_funil_pipeline_map
  ADD CONSTRAINT sm_funil_pipeline_map_role_pipeline_check
  CHECK (role <> 'pipeline' OR pipeline_id IS NOT NULL);
