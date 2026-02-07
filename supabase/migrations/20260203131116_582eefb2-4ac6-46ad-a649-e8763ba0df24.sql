-- Tabela de Clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  
  -- Dados pessoais
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  
  -- Endereço
  cep TEXT,
  estado TEXT,
  cidade TEXT,
  bairro TEXT,
  rua TEXT,
  numero TEXT,
  complemento TEXT,
  
  -- Dados do projeto solar
  potencia_kwp NUMERIC,
  valor_projeto NUMERIC,
  data_instalacao DATE,
  numero_placas INTEGER,
  modelo_inversor TEXT,
  
  -- Controle
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Recebimentos (contratos/acordos de pagamento)
CREATE TABLE public.recebimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  
  -- Valores acordados
  valor_total NUMERIC NOT NULL,
  forma_pagamento_acordada TEXT NOT NULL, -- pix, boleto, cartao, dinheiro, cheque
  numero_parcelas INTEGER NOT NULL DEFAULT 1,
  
  -- Controle
  descricao TEXT,
  data_acordo DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, parcial, quitado, cancelado
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Pagamentos (registros individuais de cada pagamento)
CREATE TABLE public.pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recebimento_id UUID NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  
  -- Dados do pagamento realizado
  valor_pago NUMERIC NOT NULL,
  forma_pagamento TEXT NOT NULL, -- pode ser diferente do acordado
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Controle
  comprovante_url TEXT,
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Políticas para Clientes (apenas usuários autenticados)
CREATE POLICY "Usuários autenticados podem ver clientes"
ON public.clientes FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar clientes"
ON public.clientes FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar clientes"
ON public.clientes FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar clientes"
ON public.clientes FOR DELETE
USING (auth.role() = 'authenticated');

-- Políticas para Recebimentos
CREATE POLICY "Usuários autenticados podem ver recebimentos"
ON public.recebimentos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar recebimentos"
ON public.recebimentos FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar recebimentos"
ON public.recebimentos FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar recebimentos"
ON public.recebimentos FOR DELETE
USING (auth.role() = 'authenticated');

-- Políticas para Pagamentos
CREATE POLICY "Usuários autenticados podem ver pagamentos"
ON public.pagamentos FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar pagamentos"
ON public.pagamentos FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar pagamentos"
ON public.pagamentos FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar pagamentos"
ON public.pagamentos FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recebimentos_updated_at
BEFORE UPDATE ON public.recebimentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar status do recebimento automaticamente
CREATE OR REPLACE FUNCTION public.update_recebimento_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_pago NUMERIC;
  valor_recebimento NUMERIC;
BEGIN
  -- Calcular total pago
  SELECT COALESCE(SUM(valor_pago), 0) INTO total_pago
  FROM public.pagamentos
  WHERE recebimento_id = COALESCE(NEW.recebimento_id, OLD.recebimento_id);
  
  -- Pegar valor total do recebimento
  SELECT valor_total INTO valor_recebimento
  FROM public.recebimentos
  WHERE id = COALESCE(NEW.recebimento_id, OLD.recebimento_id);
  
  -- Atualizar status
  UPDATE public.recebimentos
  SET status = CASE
    WHEN total_pago >= valor_recebimento THEN 'quitado'
    WHEN total_pago > 0 THEN 'parcial'
    ELSE 'pendente'
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.recebimento_id, OLD.recebimento_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para atualizar status quando pagamento é inserido/atualizado/deletado
CREATE TRIGGER trigger_update_recebimento_status
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_recebimento_status();