
-- 1. Adicionar FKs em recibos_emitidos
ALTER TABLE public.recibos_emitidos
  ADD COLUMN IF NOT EXISTS pagamento_id uuid REFERENCES public.pagamentos(id),
  ADD COLUMN IF NOT EXISTS parcela_id uuid REFERENCES public.parcelas(id),
  ADD COLUMN IF NOT EXISTS recebimento_id uuid REFERENCES public.recebimentos(id);

CREATE INDEX IF NOT EXISTS idx_recibos_pagamento_id ON public.recibos_emitidos(pagamento_id);

-- 2. Adicionar flag de lançamento automático em lancamentos_financeiros
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS is_automatic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_id uuid; -- ID genérico para vínculo (pagamento_id ou recibo_id)

CREATE INDEX IF NOT EXISTS idx_lancamentos_source_id ON public.lancamentos_financeiros(source_id);

-- 3. Criar VIEW Canônica de Receitas
-- Regra: Pega todos os pagamentos realizados (não estornados) + lançamentos de receita que NÃO vieram de pagamentos
CREATE OR REPLACE VIEW public.vw_receitas_canonicas AS
SELECT 
  tenant_id,
  id as original_id,
  'pagamento' as origem,
  valor_pago as valor,
  data_pagamento as data_referencia,
  forma_pagamento,
  recebimento_id,
  parcela_id,
  observacoes as descricao
FROM public.pagamentos
WHERE coalesce(estornado, false) = false

UNION ALL

-- Lançamentos financeiros de receita que não são automáticos (avulsos)
-- OU que não possuem source_id vinculado a um pagamento
SELECT 
  tenant_id,
  id as original_id,
  'lancamento' as origem,
  valor,
  data_lancamento as data_referencia,
  forma_pagamento,
  NULL::uuid as recebimento_id,
  NULL::uuid as parcela_id,
  descricao
FROM public.lancamentos_financeiros
WHERE tipo = 'receita' 
  AND (is_automatic = false OR source_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.pagamentos p WHERE p.id = source_id));

-- 4. Função para vincular recibo ao pagamento e evitar duplicidade
-- Se um recibo for emitido a partir de um pagamento, o pagamento é a verdade financeira.
CREATE OR REPLACE FUNCTION public.fn_sync_recibo_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Se o recibo tem pagamento_id, ele é um documento derivado.
    -- O pagamento já conta como receita via vw_receitas_canonicas.
    -- Portanto, não criamos lançamento financeiro de receita para recibos vinculados.
    
    IF (NEW.pagamento_id IS NOT NULL) THEN
        -- Apenas logamos a emissão do documento
        INSERT INTO public.financial_audit_logs (
            tenant_id, actor_id, entity_type, entity_id, action,
            after_data, reason
        ) VALUES (
            NEW.tenant_id, NEW.created_by, 'recibo', NEW.id, 'emit_from_payment',
            jsonb_build_object('pagamento_id', NEW.pagamento_id, 'valor', NEW.valor),
            'Recibo emitido vinculado a pagamento real. Sem impacto em fluxo de caixa avulso.'
        );
    ELSE
        -- Recibo avulso (sem pagamento_id): criamos lançamento financeiro de receita automático
        INSERT INTO public.lancamentos_financeiros (
            tenant_id, tipo, categoria, descricao, valor, data_lancamento, 
            status, is_automatic, source_id, created_by
        ) VALUES (
            NEW.tenant_id, 'receita', 'Recibo Avulso', NEW.descricao, NEW.valor, CURRENT_DATE,
            'pago', true, NEW.id, NEW.created_by
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Gatilho para processar recibos
DROP TRIGGER IF EXISTS tr_sync_recibo_financeiro ON public.recibos_emitidos;
CREATE TRIGGER tr_sync_recibo_financeiro
AFTER INSERT ON public.recibos_emitidos
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_recibo_financeiro();
