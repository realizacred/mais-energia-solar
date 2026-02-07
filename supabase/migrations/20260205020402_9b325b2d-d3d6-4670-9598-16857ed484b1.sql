-- Tabela de parcelas para controle de vencimentos
CREATE TABLE public.parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'atrasada', 'cancelada')),
  pagamento_id UUID REFERENCES public.pagamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(recebimento_id, numero_parcela)
);

-- Enable RLS
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem ver parcelas"
ON public.parcelas FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar parcelas"
ON public.parcelas FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar parcelas"
ON public.parcelas FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar parcelas"
ON public.parcelas FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_parcelas_updated_at
BEFORE UPDATE ON public.parcelas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar status de parcelas atrasadas
CREATE OR REPLACE FUNCTION public.update_parcelas_atrasadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.parcelas
  SET status = 'atrasada', updated_at = now()
  WHERE status = 'pendente' 
    AND data_vencimento < CURRENT_DATE;
END;
$$;