
-- ═══════════════════════════════════════════════════════════
-- Inteligência Comercial: 3 tables
-- ═══════════════════════════════════════════════════════════

-- 1. Lead Intelligence Profiles
CREATE TABLE public.lead_intelligence_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  temperamento varchar(20) CHECK (temperamento IN ('quente', 'morno', 'frio', 'congelado')),
  dor_principal varchar(50),
  objecao_detectada varchar(100),
  urgencia_score int CHECK (urgencia_score BETWEEN 0 AND 100),
  valor_perdido_acumulado decimal(12,2) DEFAULT 0,
  tarifa_atual_vs_historico decimal(5,2),
  primeiro_contato timestamptz,
  ultimo_contato timestamptz,
  dias_inativo int DEFAULT 0,
  cliques_proposta int DEFAULT 0,
  mensagens_troca int DEFAULT 0,
  status_acao varchar(30) DEFAULT 'monitorando' CHECK (status_acao IN ('monitorando', 'alertado_consultor', 'alertado_gerente', 'acao_tomada', 'convertido', 'perdido')),
  analisado_por varchar(20) CHECK (analisado_por IN ('ia', 'manual', 'sistema')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_lip_tenant_lead ON public.lead_intelligence_profiles(tenant_id, lead_id);
CREATE INDEX idx_lip_temperamento ON public.lead_intelligence_profiles(tenant_id, temperamento);
CREATE INDEX idx_lip_urgencia ON public.lead_intelligence_profiles(tenant_id, urgencia_score DESC);

ALTER TABLE public.lead_intelligence_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lip_select" ON public.lead_intelligence_profiles FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "lip_insert" ON public.lead_intelligence_profiles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "lip_update" ON public.lead_intelligence_profiles FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "lip_delete" ON public.lead_intelligence_profiles FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 2. Intelligence Alerts
CREATE TABLE public.intelligence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_intelligence_id uuid REFERENCES public.lead_intelligence_profiles(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  tipo_alerta varchar(50) NOT NULL,
  severidade varchar(20) NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
  direcionado_para varchar(20) CHECK (direcionado_para IN ('consultor', 'gerente', 'ambos')),
  consultor_id uuid,
  gerente_id uuid,
  contexto_json jsonb DEFAULT '{}'::jsonb,
  margem_disponivel decimal(5,2),
  acao_tomada varchar(50),
  desconto_autorizado decimal(5,2),
  resultado varchar(20) CHECK (resultado IN ('sucesso', 'fracasso', 'pendente')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvido_at timestamptz
);

CREATE INDEX idx_ia_tenant_created ON public.intelligence_alerts(tenant_id, created_at DESC);
CREATE INDEX idx_ia_pending ON public.intelligence_alerts(tenant_id, resolvido_at) WHERE resolvido_at IS NULL;

ALTER TABLE public.intelligence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_select" ON public.intelligence_alerts FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ia_insert" ON public.intelligence_alerts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ia_update" ON public.intelligence_alerts FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ia_delete" ON public.intelligence_alerts FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 3. Intelligence Config (per tenant)
CREATE TABLE public.intelligence_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  ia_analise_habilitada boolean DEFAULT true,
  alertas_habilitados boolean DEFAULT true,
  reaquecimento_automatico boolean DEFAULT false,
  threshold_quente int DEFAULT 80,
  threshold_morno int DEFAULT 50,
  threshold_frio int DEFAULT 20,
  alerta_preco_habilitado boolean DEFAULT true,
  alerta_preco_palavras text[] DEFAULT '{caro,dinheiro,pagar,investimento,preço,barato}'::text[],
  alerta_preco_min_confidence decimal(3,2) DEFAULT 0.85,
  alerta_tempo_habilitado boolean DEFAULT true,
  alerta_tempo_palavras text[] DEFAULT '{demora,rápido,urgente,prazo,tempo,quando}'::text[],
  alerta_concorrencia_habilitado boolean DEFAULT true,
  alerta_concorrencia_palavras text[] DEFAULT '{outro,concorrente,empresa,orçamento,proposta}'::text[],
  consultor_autoriza_ate decimal(5,2) DEFAULT 3.00,
  gerente_autoriza_ate decimal(5,2) DEFAULT 8.00,
  sempre_alertar_gerente_se_valor_acima decimal(12,2) DEFAULT 50000.00,
  reaquecimento_dias_inativo int DEFAULT 180,
  reaquecimento_max_mensagens int DEFAULT 3,
  reaquecimento_canais varchar[] DEFAULT '{whatsapp,email}'::varchar[],
  ia_modelo varchar(50) DEFAULT 'gemini-flash',
  ia_temperatura decimal(3,2) DEFAULT 0.70,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.intelligence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_select" ON public.intelligence_config FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ic_insert" ON public.intelligence_config FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ic_update" ON public.intelligence_config FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Trigger for updated_at on profiles
CREATE TRIGGER update_lip_updated_at
  BEFORE UPDATE ON public.lead_intelligence_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ic_updated_at
  BEFORE UPDATE ON public.intelligence_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
