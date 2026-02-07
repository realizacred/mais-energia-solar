-- Criar enum para tipos de serviço
CREATE TYPE public.servico_tipo AS ENUM (
  'instalacao',
  'manutencao',
  'visita_tecnica',
  'suporte'
);

-- Criar enum para status do serviço
CREATE TYPE public.servico_status AS ENUM (
  'agendado',
  'em_andamento',
  'concluido',
  'cancelado',
  'reagendado'
);

-- Criar tabela de serviços agendados
CREATE TABLE public.servicos_agendados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  instalador_id UUID NOT NULL,
  tipo public.servico_tipo NOT NULL,
  status public.servico_status NOT NULL DEFAULT 'agendado',
  data_agendada DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  descricao TEXT,
  observacoes TEXT,
  observacoes_conclusao TEXT,
  checklist_id UUID REFERENCES public.checklists_instalacao(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servicos_agendados ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
CREATE TRIGGER update_servicos_agendados_updated_at
  BEFORE UPDATE ON public.servicos_agendados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Policies
CREATE POLICY "Admin/Gerente podem gerenciar todos serviços"
  ON public.servicos_agendados
  FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Instalador pode ver seus serviços"
  ON public.servicos_agendados
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instalador'::app_role) 
    AND instalador_id = auth.uid()
  );

CREATE POLICY "Instalador pode atualizar seus serviços"
  ON public.servicos_agendados
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'instalador'::app_role) 
    AND instalador_id = auth.uid()
  );

-- Index para melhor performance
CREATE INDEX idx_servicos_agendados_instalador ON public.servicos_agendados(instalador_id);
CREATE INDEX idx_servicos_agendados_data ON public.servicos_agendados(data_agendada);
CREATE INDEX idx_servicos_agendados_status ON public.servicos_agendados(status);
CREATE INDEX idx_servicos_agendados_cliente ON public.servicos_agendados(cliente_id);