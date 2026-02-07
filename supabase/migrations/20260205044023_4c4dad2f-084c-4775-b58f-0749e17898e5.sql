-- Tabela para armazenar layouts solares
CREATE TABLE public.layouts_solares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'Layout sem nome',
  
  -- Vínculos flexíveis (pelo menos um deve estar preenchido)
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES public.servicos_agendados(id) ON DELETE SET NULL,
  
  -- Dados do layout (JSON completo)
  layout_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadados
  total_modulos INTEGER NOT NULL DEFAULT 0,
  potencia_estimada_kwp NUMERIC,
  tipo_telhado TEXT,
  
  -- Thumbnail para preview rápido
  thumbnail_url TEXT,
  
  -- Rastreamento
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_layouts_solares_projeto ON public.layouts_solares(projeto_id);
CREATE INDEX idx_layouts_solares_cliente ON public.layouts_solares(cliente_id);
CREATE INDEX idx_layouts_solares_servico ON public.layouts_solares(servico_id);

-- Trigger para updated_at
CREATE TRIGGER update_layouts_solares_updated_at
  BEFORE UPDATE ON public.layouts_solares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.layouts_solares ENABLE ROW LEVEL SECURITY;

-- Admin/Gerente podem gerenciar todos layouts
CREATE POLICY "Admin/Gerente gerenciam layouts"
  ON public.layouts_solares
  FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Vendedor pode ver/editar layouts de seus projetos/clientes
CREATE POLICY "Vendedor acessa layouts de seus projetos"
  ON public.layouts_solares
  FOR ALL
  USING (
    has_role(auth.uid(), 'vendedor'::app_role) AND (
      projeto_id IN (SELECT id FROM projetos WHERE vendedor_id = auth.uid()) OR
      servico_id IN (SELECT id FROM servicos_agendados WHERE id IN (SELECT id FROM projetos WHERE vendedor_id = auth.uid()))
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'vendedor'::app_role)
  );

-- Instalador pode ver/editar layouts dos serviços atribuídos a ele
CREATE POLICY "Instalador acessa layouts de seus serviços"
  ON public.layouts_solares
  FOR ALL
  USING (
    has_role(auth.uid(), 'instalador'::app_role) AND (
      servico_id IN (SELECT id FROM servicos_agendados WHERE instalador_id = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'instalador'::app_role) AND (
      servico_id IN (SELECT id FROM servicos_agendados WHERE instalador_id = auth.uid())
    )
  );