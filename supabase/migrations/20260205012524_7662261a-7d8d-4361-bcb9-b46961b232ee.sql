-- Adicionar colunas de metas individuais na tabela vendedor_metas existente
ALTER TABLE public.vendedor_metas
ADD COLUMN IF NOT EXISTS usa_meta_individual boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS progresso_notificado jsonb DEFAULT '{"50": false, "80": false, "100": false}'::jsonb;

-- Criar tabela para métricas de performance calculadas
CREATE TABLE IF NOT EXISTS public.vendedor_metricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano integer NOT NULL CHECK (ano >= 2020),
  -- Métricas calculadas
  tempo_medio_fechamento_dias numeric DEFAULT 0,
  taxa_resposta_rapida_percent numeric DEFAULT 0,
  ticket_medio numeric DEFAULT 0,
  taxa_retencao_percent numeric DEFAULT 0,
  total_leads_atendidos integer DEFAULT 0,
  leads_respondidos_24h integer DEFAULT 0,
  leads_convertidos integer DEFAULT 0,
  leads_perdidos integer DEFAULT 0,
  valor_total_vendas numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, mes, ano)
);

-- Enable RLS
ALTER TABLE public.vendedor_metricas ENABLE ROW LEVEL SECURITY;

-- Policies para vendedor_metricas
CREATE POLICY "Anyone can view metricas" ON public.vendedor_metricas
  FOR SELECT USING (true);

CREATE POLICY "Admin can manage metricas" ON public.vendedor_metricas
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Tabela para notificações de progresso de metas
CREATE TABLE IF NOT EXISTS public.meta_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  tipo_meta text NOT NULL, -- 'orcamentos', 'conversoes', 'valor'
  percentual_atingido integer NOT NULL, -- 50, 80, 100
  lida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, mes, ano, tipo_meta, percentual_atingido)
);

-- Enable RLS
ALTER TABLE public.meta_notifications ENABLE ROW LEVEL SECURITY;

-- Policies para meta_notifications
CREATE POLICY "Vendedor can view own notifications" ON public.meta_notifications
  FOR SELECT USING (
    vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
    OR has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role])
  );

CREATE POLICY "System can insert notifications" ON public.meta_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Vendedor can update own notifications" ON public.meta_notifications
  FOR UPDATE USING (
    vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
  );

-- Trigger para updated_at
CREATE TRIGGER update_vendedor_metricas_updated_at
  BEFORE UPDATE ON public.vendedor_metricas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();