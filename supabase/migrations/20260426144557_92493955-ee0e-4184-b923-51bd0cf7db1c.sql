-- ─────────────────────────────────────────────────────────────
-- sm_custom_field_mapping
-- Tabela de mapeamento entre custom fields do SolarMarket (staging)
-- e custom fields nativos do CRM (deal_custom_fields).
--
-- Substitui o map hardcoded CAP_FIELD_ALIAS_MAP de
-- sm-promote-custom-fields. Cada tenant configura via UI
-- (Step 2 da Migração SolarMarket → aba Custom Fields).
--
-- Ações suportadas:
--   - 'map'        : mapear slug SM → field_key existente no CRM
--   - 'create_new' : criar novo deal_custom_fields no save (eager)
--   - 'ignore'     : ignorar slug (não migra)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.sm_custom_field_mapping (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identidade do campo no SolarMarket (origem)
  sm_field_key          text        NOT NULL,
  sm_field_label        text,
  sm_field_type         text,
  sm_topic              text,

  -- Decisão do usuário
  action                text        NOT NULL
                                    CHECK (action IN ('map', 'create_new', 'ignore')),

  -- Destino no CRM (preenchido em 'map' e 'create_new' após eager insert)
  crm_field_id          uuid        REFERENCES public.deal_custom_fields(id) ON DELETE SET NULL,

  -- Metadados usados quando action='create_new' (gera field_key final via prefixo+slug)
  crm_field_context     text        CHECK (crm_field_context IS NULL OR crm_field_context IN ('projeto', 'pre_dimensionamento', 'pos_dimensionamento')),
  crm_field_type        text        CHECK (crm_field_type    IS NULL OR crm_field_type    IN ('text', 'textarea', 'select', 'file', 'currency', 'boolean')),
  crm_field_name_input  text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,

  CONSTRAINT sm_cfm_unique UNIQUE (tenant_id, sm_field_key),

  -- CHECK condicional por action
  CONSTRAINT sm_cfm_action_consistency CHECK (
    (action = 'map'
      AND crm_field_id IS NOT NULL
      AND crm_field_context IS NULL
      AND crm_field_type IS NULL
      AND crm_field_name_input IS NULL)
    OR
    (action = 'create_new'
      AND crm_field_context    IS NOT NULL
      AND crm_field_type       IS NOT NULL
      AND crm_field_name_input IS NOT NULL)
    OR
    (action = 'ignore'
      AND crm_field_id          IS NULL
      AND crm_field_context     IS NULL
      AND crm_field_type        IS NULL
      AND crm_field_name_input  IS NULL)
  )
);

CREATE INDEX idx_sm_cfm_tenant       ON public.sm_custom_field_mapping(tenant_id);
CREATE INDEX idx_sm_cfm_crm_field    ON public.sm_custom_field_mapping(crm_field_id);

-- Trigger updated_at
CREATE TRIGGER trg_sm_cfm_updated_at
BEFORE UPDATE ON public.sm_custom_field_mapping
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- RLS — isolamento por tenant
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sm_custom_field_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_cfm_tenant_select"
  ON public.sm_custom_field_mapping
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "sm_cfm_tenant_insert"
  ON public.sm_custom_field_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "sm_cfm_tenant_update"
  ON public.sm_custom_field_mapping
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "sm_cfm_tenant_delete"
  ON public.sm_custom_field_mapping
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Service role bypass (edge functions com SERVICE_ROLE_KEY já bypassa RLS;
-- política explícita para clareza/auditoria)
CREATE POLICY "sm_cfm_service_role_all"
  ON public.sm_custom_field_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- SEED (Ajuste 1) — 9 mapeamentos que existiam hardcoded em
-- CAP_FIELD_ALIAS_MAP. Específico do tenant
-- 17de8315-2e2f-4a79-8751-e5d507d69a41 (cliente atual SM).
-- Tenants futuros configuram tudo via UI.
--
-- sm_custom_fields_raw armazena tudo em payload (jsonb):
--   payload->'key'->>0  → slug
--   payload->>'name'    → label
--   payload->>'type'    → field_type
-- ─────────────────────────────────────────────────────────────
WITH seed(sm_field_key, crm_field_key) AS (
  VALUES
    ('cap_obs',                  'cap_obs'),
    ('cap_equipamento',          'cap_equipamento'),
    ('cap_localizacao',          'cap_localizacao'),
    ('cap_wifi',                 'cap_wifi'),
    ('cap_disjuntor',            'cap_disjuntor'),
    ('cap_transformador',        'cap_transformador'),
    ('cap_identidade',           'cap_identidade'),
    ('cap_comprovante_endereco', 'cap_comprovante_endereco'),
    ('capo_observacoes',         'cap_obs')
),
sm_meta AS (
  SELECT
    payload->'key'->>0   AS sm_field_key,
    payload->>'name'     AS sm_field_label,
    payload->>'type'     AS sm_field_type
  FROM public.sm_custom_fields_raw
  WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
)
INSERT INTO public.sm_custom_field_mapping (
  tenant_id,
  sm_field_key,
  sm_field_label,
  sm_field_type,
  sm_topic,
  action,
  crm_field_id
)
SELECT
  '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid,
  s.sm_field_key,
  COALESCE(m.sm_field_label, s.sm_field_key),
  COALESCE(m.sm_field_type, 'text'),
  NULL,
  'map',
  dcf.id
FROM seed s
JOIN public.deal_custom_fields dcf
  ON dcf.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
 AND dcf.field_key = s.crm_field_key
LEFT JOIN sm_meta m
  ON m.sm_field_key = s.sm_field_key
ON CONFLICT (tenant_id, sm_field_key) DO NOTHING;