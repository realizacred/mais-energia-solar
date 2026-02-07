-- ==========================================
-- GAMIFICATION SYSTEM TABLES
-- ==========================================

-- Tipos de conquistas
CREATE TYPE public.achievement_type AS ENUM (
  'first_conversion',      -- Primeira conversão
  'fast_responder',        -- Responder em menos de 1h
  'conversion_streak',     -- Sequência de conversões
  'monthly_champion',      -- Campeão do mês
  'top_performer',         -- Top 3 do ranking
  'consistency_king',      -- Metas batidas 3 meses seguidos
  'high_volume',           -- Alto volume de captações
  'perfect_month'          -- 100% da meta
);

-- Configuração de metas (valores padrão + override por vendedor)
CREATE TABLE public.gamification_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Metas padrão mensais
  meta_orcamentos_mensal INTEGER NOT NULL DEFAULT 30,
  meta_conversoes_mensal INTEGER NOT NULL DEFAULT 10,
  meta_valor_mensal NUMERIC NOT NULL DEFAULT 150000,
  -- Comissões padrão (percentual)
  comissao_base_percent NUMERIC NOT NULL DEFAULT 2.0,
  comissao_bonus_meta_percent NUMERIC NOT NULL DEFAULT 0.5,
  -- Configurações de conquistas
  achievement_points JSONB NOT NULL DEFAULT '{
    "first_conversion": 100,
    "fast_responder": 50,
    "conversion_streak": 200,
    "monthly_champion": 500,
    "top_performer": 300,
    "consistency_king": 1000,
    "high_volume": 150,
    "perfect_month": 400
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Metas individuais por vendedor (override do padrão)
CREATE TABLE public.vendedor_metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  -- Metas customizadas (null = usar padrão)
  meta_orcamentos INTEGER,
  meta_conversoes INTEGER,
  meta_valor NUMERIC,
  -- Comissão customizada
  comissao_percent NUMERIC,
  -- Observações do gestor
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, ano, mes)
);

-- Conquistas desbloqueadas por vendedor
CREATE TABLE public.vendedor_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  achievement_type public.achievement_type NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Contexto da conquista (ex: mês em que bateu meta)
  metadata JSONB,
  UNIQUE(vendedor_id, achievement_type)
);

-- Histórico mensal de performance (para ranking)
CREATE TABLE public.vendedor_performance_mensal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  -- Métricas do mês
  total_orcamentos INTEGER NOT NULL DEFAULT 0,
  total_conversoes INTEGER NOT NULL DEFAULT 0,
  valor_total_vendas NUMERIC NOT NULL DEFAULT 0,
  tempo_medio_resposta_horas NUMERIC,
  -- Pontuação calculada
  pontuacao_total INTEGER NOT NULL DEFAULT 0,
  -- Rankings
  posicao_ranking INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, ano, mes)
);

-- Enable RLS on all tables
ALTER TABLE public.gamification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedor_performance_mensal ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamification_config
CREATE POLICY "Anyone can view gamification config"
  ON public.gamification_config FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage gamification config"
  ON public.gamification_config FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- RLS Policies for vendedor_metas
CREATE POLICY "Admin/Gerente can manage vendedor metas"
  ON public.vendedor_metas FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Vendedor can view own metas"
  ON public.vendedor_metas FOR SELECT
  USING (
    vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
  );

-- RLS Policies for vendedor_achievements
CREATE POLICY "Anyone can view achievements"
  ON public.vendedor_achievements FOR SELECT
  USING (true);

CREATE POLICY "System can insert achievements"
  ON public.vendedor_achievements FOR INSERT
  WITH CHECK (true);

-- RLS Policies for vendedor_performance_mensal
CREATE POLICY "Anyone can view performance"
  ON public.vendedor_performance_mensal FOR SELECT
  USING (true);

CREATE POLICY "System can manage performance"
  ON public.vendedor_performance_mensal FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Trigger for updated_at
CREATE TRIGGER update_gamification_config_updated_at
  BEFORE UPDATE ON public.gamification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_metas_updated_at
  BEFORE UPDATE ON public.vendedor_metas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedor_performance_updated_at
  BEFORE UPDATE ON public.vendedor_performance_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.gamification_config (id) VALUES (gen_random_uuid());