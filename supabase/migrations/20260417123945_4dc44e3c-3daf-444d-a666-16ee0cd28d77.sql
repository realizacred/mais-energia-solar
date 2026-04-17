-- =============================================================================
-- FASE A — FUNDAÇÃO DE DADOS DA MIGRAÇÃO SOLARMARKET
-- =============================================================================
-- Regra canônica: proposta é o único critério de elegibilidade.
-- Classificação define apenas o destino (funil/etapa).
-- telefone_valido é indicador operacional, NUNCA bloqueio.
-- =============================================================================

-- 1) ENUM para tipo de pipeline de destino
DO $$ BEGIN
  CREATE TYPE public.sm_pipeline_kind AS ENUM (
    'comercial',
    'engenharia',
    'equipamento',
    'compensacao',
    'verificar_dados'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Helper: is_admin_or_super (SECURITY DEFINER, evita recursão RLS)
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

COMMENT ON FUNCTION public.is_admin_or_super IS
'Retorna true se o usuário tem role admin ou super_admin. Usada em RLS de classificação SM.';

-- 3) Função de validação de telefone (qualidade operacional, NÃO bloqueia migração)
CREATE OR REPLACE FUNCTION public.validate_phone_quality(_phone text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text;
  len int;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN
    RETURN false;
  END IF;

  -- Extrair apenas dígitos
  digits := regexp_replace(_phone, '\D', '', 'g');
  len := length(digits);

  -- Tamanho válido: 10 a 13 dígitos (inclui DDI)
  IF len < 10 OR len > 13 THEN
    RETURN false;
  END IF;

  -- Sequência repetida (ex: 99999999999, 11111111111)
  IF digits ~ '^(\d)\1+$' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.validate_phone_quality IS
'Indicador de qualidade do telefone. Retorna true/false. NÃO usado como critério de elegibilidade de migração.';

-- 4) Tabela sm_project_classification
CREATE TABLE IF NOT EXISTS public.sm_project_classification (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sm_project_id         uuid NOT NULL REFERENCES public.solar_market_projects(id) ON DELETE CASCADE,

  -- Versionamento de classificação (auditável)
  classification_version int NOT NULL DEFAULT 1,

  -- Destino calculado
  pipeline_kind         public.sm_pipeline_kind NOT NULL DEFAULT 'verificar_dados',
  funil_destino_id      uuid REFERENCES public.projeto_funis(id) ON DELETE SET NULL,
  etapa_destino_id      uuid REFERENCES public.projeto_etapas(id) ON DELETE SET NULL,

  -- Indicador de qualidade (NÃO bloqueia migração)
  telefone_valido       boolean NOT NULL DEFAULT false,

  -- Motivo da classificação automática
  motivo                text,

  -- Override manual (apenas admin/super_admin)
  override_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  override_reason       text,
  overridden_at         timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Uma classificação por projeto SM
  CONSTRAINT sm_project_classification_unique UNIQUE (sm_project_id),

  -- Override exige motivo
  CONSTRAINT sm_classification_override_requires_reason
    CHECK (
      (override_by IS NULL AND override_reason IS NULL AND overridden_at IS NULL)
      OR
      (override_by IS NOT NULL AND override_reason IS NOT NULL AND length(trim(override_reason)) > 0 AND overridden_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.sm_project_classification IS
'Classificação de destino (funil/etapa) por projeto SolarMarket. Não controla elegibilidade — apenas destino.';

COMMENT ON COLUMN public.sm_project_classification.telefone_valido IS
'Indicador de qualidade. NÃO usado como critério de elegibilidade de migração.';

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_sm_classification_tenant
  ON public.sm_project_classification(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sm_classification_sm_project
  ON public.sm_project_classification(sm_project_id);
CREATE INDEX IF NOT EXISTS idx_sm_classification_pipeline_kind
  ON public.sm_project_classification(tenant_id, pipeline_kind);
CREATE INDEX IF NOT EXISTS idx_sm_classification_funil
  ON public.sm_project_classification(tenant_id, funil_destino_id);

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_sm_classification_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_classification_updated_at ON public.sm_project_classification;
CREATE TRIGGER trg_sm_classification_updated_at
BEFORE UPDATE ON public.sm_project_classification
FOR EACH ROW
EXECUTE FUNCTION public.tg_sm_classification_updated_at();

-- 7) Trigger: incrementa classification_version a cada UPDATE de destino
CREATE OR REPLACE FUNCTION public.tg_sm_classification_bump_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.pipeline_kind IS DISTINCT FROM OLD.pipeline_kind)
     OR (NEW.funil_destino_id IS DISTINCT FROM OLD.funil_destino_id)
     OR (NEW.etapa_destino_id IS DISTINCT FROM OLD.etapa_destino_id) THEN
    NEW.classification_version := COALESCE(OLD.classification_version, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_classification_bump_version ON public.sm_project_classification;
CREATE TRIGGER trg_sm_classification_bump_version
BEFORE UPDATE ON public.sm_project_classification
FOR EACH ROW
EXECUTE FUNCTION public.tg_sm_classification_bump_version();

-- 8) RLS
ALTER TABLE public.sm_project_classification ENABLE ROW LEVEL SECURITY;

-- SELECT: membros do tenant
DROP POLICY IF EXISTS "sm_classification_select" ON public.sm_project_classification;
CREATE POLICY "sm_classification_select"
ON public.sm_project_classification
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- INSERT: admin/super_admin do tenant
DROP POLICY IF EXISTS "sm_classification_insert" ON public.sm_project_classification;
CREATE POLICY "sm_classification_insert"
ON public.sm_project_classification
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin_or_super(auth.uid())
);

-- UPDATE: admin/super_admin do tenant
DROP POLICY IF EXISTS "sm_classification_update" ON public.sm_project_classification;
CREATE POLICY "sm_classification_update"
ON public.sm_project_classification
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin_or_super(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin_or_super(auth.uid())
);

-- DELETE: super_admin apenas
DROP POLICY IF EXISTS "sm_classification_delete" ON public.sm_project_classification;
CREATE POLICY "sm_classification_delete"
ON public.sm_project_classification
FOR DELETE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.has_role(auth.uid(), 'super_admin')
);