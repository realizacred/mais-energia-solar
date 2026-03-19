-- Tabela de oportunidades de reaquecimento
CREATE TABLE IF NOT EXISTS public.reaquecimento_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  data_analise timestamptz NOT NULL DEFAULT now(),
  meses_inativos int NOT NULL DEFAULT 0,
  valor_perdido_acumulado decimal(12,2) NOT NULL DEFAULT 0,
  novo_valor_projeto decimal(12,2),
  economia_potencial_12m decimal(12,2),
  mensagem_sugerida text NOT NULL DEFAULT '',
  temperamento_detectado varchar(20) NOT NULL DEFAULT 'congelado',
  dor_principal varchar(50) NOT NULL DEFAULT 'preco',
  urgencia_score int NOT NULL DEFAULT 50,
  contexto_json jsonb DEFAULT '{}',
  status varchar(30) NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  resultado varchar(50),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_reaquecimento_tenant_status ON public.reaquecimento_oportunidades(tenant_id, status);
CREATE INDEX idx_reaquecimento_lead ON public.reaquecimento_oportunidades(lead_id);
CREATE INDEX idx_reaquecimento_data ON public.reaquecimento_oportunidades(data_analise);

-- RLS
ALTER TABLE public.reaquecimento_oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reaq_select" ON public.reaquecimento_oportunidades FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "reaq_insert" ON public.reaquecimento_oportunidades FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "reaq_update" ON public.reaquecimento_oportunidades FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "reaq_delete" ON public.reaquecimento_oportunidades FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Service role bypass for edge functions
CREATE POLICY "reaq_service_all" ON public.reaquecimento_oportunidades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_reaquecimento_updated_at
  BEFORE UPDATE ON public.reaquecimento_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC placeholder for tarifa lookup
CREATE OR REPLACE FUNCTION public.get_tarifa_atual_concessionaria(
  p_cidade varchar DEFAULT NULL,
  p_estado varchar DEFAULT NULL
) RETURNS TABLE(valor decimal) AS $$
  SELECT COALESCE(
    (SELECT c.tarifa_energia FROM public.concessionarias c WHERE c.estado = p_estado AND c.ativo = true LIMIT 1),
    0.80
  )::decimal AS valor;
$$ LANGUAGE sql SECURITY DEFINER STABLE;