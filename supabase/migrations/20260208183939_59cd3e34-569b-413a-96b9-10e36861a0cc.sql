
-- =============================================
-- FASE 1: Motor de Inteligência Comercial
-- Tabelas: lead_scoring_config + lead_scores
-- =============================================

-- Tabela de configuração de pesos do scoring
CREATE TABLE public.lead_scoring_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  
  -- Pesos por critério (0-100, somando ~100)
  peso_consumo INTEGER NOT NULL DEFAULT 25,
  peso_recencia INTEGER NOT NULL DEFAULT 20,
  peso_engajamento INTEGER NOT NULL DEFAULT 15,
  peso_perfil_tecnico INTEGER NOT NULL DEFAULT 15,
  peso_localizacao INTEGER NOT NULL DEFAULT 10,
  peso_tempo_resposta INTEGER NOT NULL DEFAULT 15,
  
  -- Thresholds de consumo (kWh)
  consumo_alto_min INTEGER NOT NULL DEFAULT 400,
  consumo_medio_min INTEGER NOT NULL DEFAULT 200,
  
  -- Thresholds de recência (dias)
  recencia_quente_max INTEGER NOT NULL DEFAULT 3,
  recencia_morna_max INTEGER NOT NULL DEFAULT 7,
  
  -- Thresholds de classificação
  threshold_hot INTEGER NOT NULL DEFAULT 70,
  threshold_warm INTEGER NOT NULL DEFAULT 40,
  
  -- Probabilidade base por nível
  probabilidade_hot NUMERIC NOT NULL DEFAULT 0.65,
  probabilidade_warm NUMERIC NOT NULL DEFAULT 0.30,
  probabilidade_cold NUMERIC NOT NULL DEFAULT 0.10,
  
  -- Ticket médio para previsão de faturamento
  ticket_medio NUMERIC NOT NULL DEFAULT 25000,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de scores calculados por lead
CREATE TABLE public.lead_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  
  -- Score e classificação
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  nivel TEXT NOT NULL DEFAULT 'cold' CHECK (nivel IN ('hot', 'warm', 'cold')),
  probabilidade_fechamento NUMERIC NOT NULL DEFAULT 0 CHECK (probabilidade_fechamento >= 0 AND probabilidade_fechamento <= 1),
  
  -- Detalhes do score
  fatores JSONB NOT NULL DEFAULT '[]'::jsonb,
  recomendacao TEXT,
  
  -- Score breakdown
  score_consumo INTEGER NOT NULL DEFAULT 0,
  score_recencia INTEGER NOT NULL DEFAULT 0,
  score_engajamento INTEGER NOT NULL DEFAULT 0,
  score_perfil_tecnico INTEGER NOT NULL DEFAULT 0,
  score_localizacao INTEGER NOT NULL DEFAULT 0,
  score_tempo_resposta INTEGER NOT NULL DEFAULT 0,
  
  -- Previsão financeira
  valor_estimado NUMERIC,
  
  -- Controle
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Um score ativo por lead
  UNIQUE(lead_id)
);

-- Índices para performance
CREATE INDEX idx_lead_scores_nivel ON public.lead_scores(nivel);
CREATE INDEX idx_lead_scores_score ON public.lead_scores(score DESC);
CREATE INDEX idx_lead_scores_calculado ON public.lead_scores(calculado_em);
CREATE INDEX idx_lead_scores_tenant ON public.lead_scores(tenant_id);

-- RLS
ALTER TABLE public.lead_scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;

-- Policies para lead_scoring_config
CREATE POLICY "Admins manage lead_scoring_config"
  ON public.lead_scoring_config FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated read lead_scoring_config"
  ON public.lead_scoring_config FOR SELECT
  USING (true);

-- Policies para lead_scores
CREATE POLICY "Admins manage lead_scores"
  ON public.lead_scores FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Vendedores read lead_scores"
  ON public.lead_scores FOR SELECT
  USING (
    lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.vendedor IN (
        SELECT v.nome FROM vendedores v WHERE v.user_id = auth.uid()
      )
    )
  );

-- Triggers de updated_at
CREATE TRIGGER update_lead_scoring_config_updated_at
  BEFORE UPDATE ON public.lead_scoring_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_scores_updated_at
  BEFORE UPDATE ON public.lead_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão
INSERT INTO public.lead_scoring_config (id) VALUES (gen_random_uuid());

-- Comentários
COMMENT ON TABLE public.lead_scoring_config IS 'Configuração de pesos e thresholds do motor de scoring de leads';
COMMENT ON TABLE public.lead_scores IS 'Scores calculados por lead com breakdown por critério e probabilidade de fechamento';
