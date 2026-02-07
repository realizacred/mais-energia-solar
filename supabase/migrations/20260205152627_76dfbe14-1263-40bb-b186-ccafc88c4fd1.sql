-- Tabela de performance/metas dos instaladores (similar a vendedores)
CREATE TABLE public.instalador_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_servicos_mensal INTEGER NOT NULL DEFAULT 20,
  meta_avaliacoes_positivas INTEGER NOT NULL DEFAULT 90, -- percentual
  meta_tempo_medio_minutos INTEGER NOT NULL DEFAULT 240, -- 4 horas
  usar_metas_individuais BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (instalador_id)
);

-- Performance mensal do instalador
CREATE TABLE public.instalador_performance_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instalador_id UUID NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL CHECK (ano >= 2020),
  total_servicos INTEGER NOT NULL DEFAULT 0,
  servicos_concluidos INTEGER NOT NULL DEFAULT 0,
  tempo_medio_minutos INTEGER DEFAULT NULL,
  avaliacoes_positivas INTEGER NOT NULL DEFAULT 0,
  avaliacoes_totais INTEGER NOT NULL DEFAULT 0,
  pontuacao_total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (instalador_id, mes, ano)
);

-- Config global de metas instaladores
CREATE TABLE public.instalador_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_servicos_mensal INTEGER NOT NULL DEFAULT 20,
  meta_avaliacoes_positivas INTEGER NOT NULL DEFAULT 90,
  meta_tempo_medio_minutos INTEGER NOT NULL DEFAULT 240,
  pontos_por_servico INTEGER NOT NULL DEFAULT 10,
  pontos_por_avaliacao_positiva INTEGER NOT NULL DEFAULT 5,
  bonus_meta_atingida INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir config padrão
INSERT INTO public.instalador_config (
  meta_servicos_mensal,
  meta_avaliacoes_positivas,
  meta_tempo_medio_minutos
) VALUES (20, 90, 240);

-- Adicionar status de validação aos serviços
ALTER TABLE public.servicos_agendados 
  ADD COLUMN IF NOT EXISTS validado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS validado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS observacoes_validacao TEXT;

-- Enable RLS
ALTER TABLE public.instalador_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instalador_performance_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instalador_config ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admin/Gerente podem gerenciar metas instaladores"
  ON public.instalador_metas FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Instalador pode ver suas próprias metas"
  ON public.instalador_metas FOR SELECT
  USING (instalador_id = auth.uid());

CREATE POLICY "Admin/Gerente podem gerenciar performance instaladores"
  ON public.instalador_performance_mensal FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Instalador pode ver sua própria performance"
  ON public.instalador_performance_mensal FOR SELECT
  USING (instalador_id = auth.uid());

CREATE POLICY "Usuários autenticados podem ver config instaladores"
  ON public.instalador_config FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin pode gerenciar config instaladores"
  ON public.instalador_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_instalador_metas_updated_at
  BEFORE UPDATE ON public.instalador_metas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instalador_performance_updated_at
  BEFORE UPDATE ON public.instalador_performance_mensal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_instalador_config_updated_at
  BEFORE UPDATE ON public.instalador_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();