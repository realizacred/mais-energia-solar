CREATE TABLE IF NOT EXISTS public.wave2_financial_fix_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  versao_id uuid,
  fix_type text NOT NULL,
  before_value numeric,
  after_value numeric,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wave2_financial_fix_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave2_log_super_admin ON public.wave2_financial_fix_log;
CREATE POLICY wave2_log_super_admin
  ON public.wave2_financial_fix_log FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TABLE IF EXISTS public.proposta_versoes_backup_wave2;
CREATE TABLE public.proposta_versoes_backup_wave2 AS
SELECT pv.*, now() AS backup_at
FROM public.proposta_versoes pv
JOIN public.propostas_nativas pn ON pn.id = pv.proposta_id
WHERE pn.external_source = 'solarmarket';

ALTER TABLE public.proposta_versoes_backup_wave2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backup_wave2_super_admin_only ON public.proposta_versoes_backup_wave2;
CREATE POLICY backup_wave2_super_admin_only
  ON public.proposta_versoes_backup_wave2 FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));