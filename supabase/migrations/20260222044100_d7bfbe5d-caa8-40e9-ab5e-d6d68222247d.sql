
-- Tabela dedicada para OS de Instalação (vinculada a propostas ganhas)
CREATE TABLE public.os_instalacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  proposta_id UUID NOT NULL REFERENCES public.propostas_nativas(id),
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id),
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  numero_os TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','agendada','em_execucao','concluida','cancelada')),
  
  -- Dados da instalação
  data_agendada DATE,
  data_inicio TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  instalador_id UUID REFERENCES public.consultores(id),
  supervisor_id UUID REFERENCES public.consultores(id),
  
  -- Dados do sistema (copiados da proposta para referência rápida)
  potencia_kwp NUMERIC,
  valor_total NUMERIC,
  
  -- Endereço
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  
  -- Observações e acompanhamento
  observacoes TEXT,
  pendencias TEXT,
  laudo_tecnico TEXT,
  fotos_urls TEXT[],
  assinatura_cliente_url TEXT,
  assinatura_instalador_url TEXT,
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Numeração automática de OS por tenant
CREATE OR REPLACE FUNCTION public.generate_os_instalacao_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(numero_os, '[^0-9]', '', 'g'), '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.os_instalacao
  WHERE tenant_id = NEW.tenant_id;
  
  NEW.numero_os := 'OS-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_os_instalacao_numero
  BEFORE INSERT ON public.os_instalacao
  FOR EACH ROW
  WHEN (NEW.numero_os IS NULL)
  EXECUTE FUNCTION public.generate_os_instalacao_number();

-- Updated_at trigger
CREATE TRIGGER update_os_instalacao_updated_at
  BEFORE UPDATE ON public.os_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.os_instalacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_instalacao_select" ON public.os_instalacao
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "os_instalacao_insert" ON public.os_instalacao
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "os_instalacao_update" ON public.os_instalacao
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "os_instalacao_delete" ON public.os_instalacao
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Índices
CREATE INDEX idx_os_instalacao_tenant ON public.os_instalacao(tenant_id);
CREATE INDEX idx_os_instalacao_proposta ON public.os_instalacao(proposta_id);
CREATE INDEX idx_os_instalacao_projeto ON public.os_instalacao(projeto_id);
CREATE INDEX idx_os_instalacao_status ON public.os_instalacao(tenant_id, status);
