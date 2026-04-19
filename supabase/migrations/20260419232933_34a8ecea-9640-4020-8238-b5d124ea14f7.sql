-- P0 SolarMarket: criar camada raw/staging isolada do domínio nativo
-- Cria 5 tabelas sm_*_raw + RLS tenant-safe + índices únicos por (tenant_id, external_id)
-- Copia os 200 clientes contaminados de public.clientes para sm_clientes_raw (preservação)
-- NÃO deleta nada do domínio nativo nesta fase.

-- ============================================================
-- 1) Tabelas raw
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sm_clientes_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sm_projetos_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sm_propostas_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sm_funis_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sm_custom_fields_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2) Índices: idempotência (UNIQUE) + lookup
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_clientes_raw_tenant_extid
  ON public.sm_clientes_raw(tenant_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_projetos_raw_tenant_extid
  ON public.sm_projetos_raw(tenant_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_propostas_raw_tenant_extid
  ON public.sm_propostas_raw(tenant_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_funis_raw_tenant_extid
  ON public.sm_funis_raw(tenant_id, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sm_custom_fields_raw_tenant_extid
  ON public.sm_custom_fields_raw(tenant_id, external_id);

CREATE INDEX IF NOT EXISTS idx_sm_clientes_raw_job ON public.sm_clientes_raw(import_job_id);
CREATE INDEX IF NOT EXISTS idx_sm_projetos_raw_job ON public.sm_projetos_raw(import_job_id);
CREATE INDEX IF NOT EXISTS idx_sm_propostas_raw_job ON public.sm_propostas_raw(import_job_id);
CREATE INDEX IF NOT EXISTS idx_sm_funis_raw_job ON public.sm_funis_raw(import_job_id);
CREATE INDEX IF NOT EXISTS idx_sm_custom_fields_raw_job ON public.sm_custom_fields_raw(import_job_id);

-- ============================================================
-- 3) Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_sm_raw_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sm_clientes_raw','sm_projetos_raw','sm_propostas_raw','sm_funis_raw','sm_custom_fields_raw']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_sm_raw_set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 4) RLS tenant-safe (usa get_user_tenant_id() já existente no projeto)
-- ============================================================
ALTER TABLE public.sm_clientes_raw       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_projetos_raw       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_propostas_raw      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_funis_raw          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_custom_fields_raw  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sm_clientes_raw','sm_projetos_raw','sm_propostas_raw','sm_funis_raw','sm_custom_fields_raw']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all    ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY %I_tenant_select ON public.%I FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id())$p$, t, t);
    -- Escrita só via service role (edge function). Sem policy = nega para authenticated.
  END LOOP;
END $$;

-- ============================================================
-- 5) FASE 5: Copiar 200 clientes contaminados para sm_clientes_raw (preservação)
--    NÃO deleta de public.clientes nesta fase.
-- ============================================================
INSERT INTO public.sm_clientes_raw (tenant_id, external_id, payload, imported_at, import_job_id)
SELECT
  c.tenant_id,
  c.external_id,
  jsonb_build_object(
    'native_id',     c.id,
    'cliente_code',  c.cliente_code,
    'nome',          c.nome,
    'email',         c.email,
    'telefone',      c.telefone,
    'cpf_cnpj',      c.cpf_cnpj,
    'cidade',        c.cidade,
    'estado',        c.estado,
    'external_source', c.external_source,
    'created_at',    c.created_at,
    'updated_at',    c.updated_at,
    '_p0_preserved_from', 'public.clientes'
  ) AS payload,
  now() AS imported_at,
  NULL  AS import_job_id
FROM public.clientes c
WHERE c.external_source = 'solarmarket'
  AND c.external_id IS NOT NULL
ON CONFLICT (tenant_id, external_id) DO NOTHING;