CREATE TABLE IF NOT EXISTS public.variable_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  mode text NOT NULL DEFAULT 'quick',
  templates_ativos integer NOT NULL DEFAULT 0,
  total_variaveis integer NOT NULL DEFAULT 0,
  quebradas integer NOT NULL DEFAULT 0,
  nulas integer NOT NULL DEFAULT 0,
  ok integer NOT NULL DEFAULT 0,
  variaveis_encontradas jsonb DEFAULT '[]'::jsonb,
  variaveis_quebradas jsonb DEFAULT '[]'::jsonb,
  variaveis_nulas jsonb DEFAULT '[]'::jsonb,
  analise_ia text,
  prompt_lovable text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.variable_audit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_variable_audit_reports"
  ON public.variable_audit_reports
  FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));