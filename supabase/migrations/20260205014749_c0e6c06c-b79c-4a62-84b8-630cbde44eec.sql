-- Create comissoes table
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor_base NUMERIC NOT NULL DEFAULT 0,
  percentual_comissao NUMERIC NOT NULL DEFAULT 2.0,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'pago')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pagamentos_comissao table
CREATE TABLE public.pagamentos_comissao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comissao_id UUID NOT NULL REFERENCES public.comissoes(id) ON DELETE CASCADE,
  valor_pago NUMERIC NOT NULL,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT NOT NULL,
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_comissao ENABLE ROW LEVEL SECURITY;

-- RLS policies for comissoes
CREATE POLICY "Admin/Gerente/Financeiro podem gerenciar comissões"
ON public.comissoes
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

CREATE POLICY "Vendedor pode ver suas próprias comissões"
ON public.comissoes
FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role) AND 
  vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
);

-- RLS policies for pagamentos_comissao
CREATE POLICY "Admin/Gerente/Financeiro podem gerenciar pagamentos de comissão"
ON public.pagamentos_comissao
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role, 'financeiro'::app_role]));

CREATE POLICY "Vendedor pode ver pagamentos das suas comissões"
ON public.pagamentos_comissao
FOR SELECT
USING (
  has_role(auth.uid(), 'vendedor'::app_role) AND 
  comissao_id IN (
    SELECT c.id FROM public.comissoes c 
    JOIN public.vendedores v ON c.vendedor_id = v.id 
    WHERE v.user_id = auth.uid()
  )
);

-- Trigger to update comissao status based on payments
CREATE OR REPLACE FUNCTION public.update_comissao_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_pago NUMERIC;
  valor_comissao_total NUMERIC;
BEGIN
  -- Calculate total paid
  SELECT COALESCE(SUM(valor_pago), 0) INTO total_pago
  FROM public.pagamentos_comissao
  WHERE comissao_id = COALESCE(NEW.comissao_id, OLD.comissao_id);
  
  -- Get comissao total value
  SELECT valor_comissao INTO valor_comissao_total
  FROM public.comissoes
  WHERE id = COALESCE(NEW.comissao_id, OLD.comissao_id);
  
  -- Update status
  UPDATE public.comissoes
  SET status = CASE
    WHEN total_pago >= valor_comissao_total THEN 'pago'
    WHEN total_pago > 0 THEN 'parcial'
    ELSE 'pendente'
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.comissao_id, OLD.comissao_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger
CREATE TRIGGER update_comissao_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_comissao
FOR EACH ROW
EXECUTE FUNCTION public.update_comissao_status();

-- Trigger to update updated_at
CREATE TRIGGER update_comissoes_updated_at
BEFORE UPDATE ON public.comissoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();