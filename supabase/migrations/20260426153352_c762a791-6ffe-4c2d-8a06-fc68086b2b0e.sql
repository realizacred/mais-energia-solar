-- Etapa A: suporte a mapeamento nativo em sm_custom_field_mapping

-- 1) Nova coluna crm_native_target (path no snapshot da proposta)
ALTER TABLE public.sm_custom_field_mapping
  ADD COLUMN IF NOT EXISTS crm_native_target text;

-- 2) Atualizar CHECK da action para incluir map_native
ALTER TABLE public.sm_custom_field_mapping
  DROP CONSTRAINT IF EXISTS sm_custom_field_mapping_action_check;

ALTER TABLE public.sm_custom_field_mapping
  ADD CONSTRAINT sm_custom_field_mapping_action_check
  CHECK (action IN ('map', 'create_new', 'ignore', 'map_native'));

-- 3) Whitelist rígida de paths nativos permitidos
ALTER TABLE public.sm_custom_field_mapping
  DROP CONSTRAINT IF EXISTS sm_cfm_native_target_whitelist;

ALTER TABLE public.sm_custom_field_mapping
  ADD CONSTRAINT sm_cfm_native_target_whitelist
  CHECK (
    crm_native_target IS NULL
    OR crm_native_target IN (
      'snapshot.tipo_telhado',
      'snapshot.garantias.modulo_sm',
      'snapshot.garantias.inversor_sm',
      'snapshot.garantias.microinversor_sm'
    )
  );

-- 4) Atualizar/criar constraint de consistência por action
ALTER TABLE public.sm_custom_field_mapping
  DROP CONSTRAINT IF EXISTS sm_cfm_action_consistency;

ALTER TABLE public.sm_custom_field_mapping
  ADD CONSTRAINT sm_cfm_action_consistency
  CHECK (
    (action = 'map' AND crm_field_id IS NOT NULL AND crm_native_target IS NULL)
    OR (action = 'create_new' AND crm_field_name_input IS NOT NULL AND crm_native_target IS NULL)
    OR (action = 'ignore' AND crm_field_id IS NULL AND crm_field_name_input IS NULL AND crm_native_target IS NULL)
    OR (action = 'map_native'
        AND crm_native_target IS NOT NULL
        AND crm_field_id IS NULL
        AND crm_field_name_input IS NULL)
  );

-- 5) Índice parcial para acelerar lookup por target nativo
CREATE INDEX IF NOT EXISTS idx_sm_cfm_native_target
  ON public.sm_custom_field_mapping (tenant_id, crm_native_target)
  WHERE action = 'map_native';

COMMENT ON COLUMN public.sm_custom_field_mapping.crm_native_target IS
  'Path destino no snapshot da proposta quando action=map_native. Whitelist: snapshot.tipo_telhado, snapshot.garantias.{modulo_sm,inversor_sm,microinversor_sm}.';