
CREATE TABLE public.fechamentos_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (current_setting('app.current_tenant_id'::text))::uuid REFERENCES public.tenants(id),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('diario','semanal','mensal')),
  total_recebido NUMERIC(12,2) DEFAULT 0,
  total_parcelas_pagas INTEGER DEFAULT 0,
  total_recebimentos_quitados INTEGER DEFAULT 0,
  breakdown_formas JSONB DEFAULT '{}',
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','conferido')),
  fechado_por UUID REFERENCES auth.users(id),
  fechado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fechamentos_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fechamentos_caixa_tenant_isolation" ON public.fechamentos_caixa
  FOR ALL TO authenticated
  USING (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid);

CREATE TRIGGER trg_fechamentos_caixa_updated_at
  BEFORE UPDATE ON public.fechamentos_caixa
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
