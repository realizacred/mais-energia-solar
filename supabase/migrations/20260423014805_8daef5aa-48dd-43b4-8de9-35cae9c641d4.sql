-- 1) Tabela de configurações padrão da migração SolarMarket
CREATE TABLE IF NOT EXISTS public.solarmarket_migration_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_pipeline_id uuid REFERENCES public.pipelines(id) ON DELETE SET NULL,
  default_consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.solarmarket_migration_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_select_smc" ON public.solarmarket_migration_config;
CREATE POLICY "tenant_select_smc" ON public.solarmarket_migration_config
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_insert_smc" ON public.solarmarket_migration_config;
CREATE POLICY "tenant_insert_smc" ON public.solarmarket_migration_config
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_update_smc" ON public.solarmarket_migration_config;
CREATE POLICY "tenant_update_smc" ON public.solarmarket_migration_config
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_delete_smc" ON public.solarmarket_migration_config;
CREATE POLICY "tenant_delete_smc" ON public.solarmarket_migration_config
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());

DROP TRIGGER IF EXISTS trg_solarmarket_migration_config_updated_at
  ON public.solarmarket_migration_config;
CREATE TRIGGER trg_solarmarket_migration_config_updated_at
  BEFORE UPDATE ON public.solarmarket_migration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Unicidade em sm_consultor_mapping para upsert por (tenant_id, sm_name)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sm_consultor_mapping_tenant_smname
  ON public.sm_consultor_mapping (tenant_id, sm_name);

-- 3) Pré-popular papéis dos funis para o tenant alvo
INSERT INTO public.sm_funil_pipeline_map (tenant_id, sm_funil_name, role, pipeline_id)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'LEAD',        'pipeline',         'ea4aacc0-b75a-4573-bce6-8006dd27a8be'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Vendedores',  'vendedor_source',  NULL),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Engenharia',  'ignore',           NULL),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Compesação',  'ignore',           NULL),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Equipamento', 'ignore',           NULL),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'Pagamento',   'ignore',           NULL)
ON CONFLICT (tenant_id, sm_funil_name) DO NOTHING;