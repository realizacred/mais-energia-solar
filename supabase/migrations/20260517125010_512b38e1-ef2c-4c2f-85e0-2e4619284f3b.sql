-- AÇÃO 2: Estrutura
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS external_ref TEXT;

-- Relaxar constraints para migração legado
ALTER TABLE public.recibos 
  ALTER COLUMN forma_pagamento DROP NOT NULL,
  ALTER COLUMN data_pagamento DROP NOT NULL;

ALTER TABLE public.recibos
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS external_ref TEXT,
  ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES public.lancamentos_financeiros(id);

-- AÇÃO 3: Função RPC
CREATE OR REPLACE FUNCTION public.get_saldo_projeto(p_projeto_id UUID)
RETURNS JSON AS $$
DECLARE
  v_valor_total DECIMAL;
  v_total_pago DECIMAL;
BEGIN
  SELECT COALESCE(valor_total, 0)
  INTO v_valor_total
  FROM public.projetos WHERE id = p_projeto_id;

  SELECT COALESCE(SUM(valor), 0)
  INTO v_total_pago
  FROM public.lancamentos_financeiros
  WHERE projeto_id = p_projeto_id
  AND tipo = 'receita'
  AND status = 'confirmado';

  RETURN json_build_object(
    'valor_total', v_valor_total,
    'total_pago', v_total_pago,
    'saldo_devedor', v_valor_total - v_total_pago,
    'percentual_pago',
      CASE WHEN v_valor_total > 0
      THEN ROUND((v_total_pago / v_valor_total * 100)::numeric, 1)
      ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migração de Dados (Idempotente)
INSERT INTO public.lancamentos_financeiros (
  tenant_id, tipo, valor, forma_pagamento,
  data_lancamento, status, origem, external_ref, projeto_id, cliente_id
)
SELECT
  p.tenant_id, 'receita', p.valor_pago,
  p.forma_pagamento, p.created_at,
  'confirmado', 'migrado_pagamentos', p.id::text, rec.projeto_id, rec.cliente_id
FROM public.pagamentos p
LEFT JOIN public.recebimentos rec ON p.recebimento_id = rec.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.lancamentos_financeiros lf
  WHERE lf.origem = 'migrado_pagamentos'
  AND lf.external_ref = p.id::text
);

INSERT INTO public.recibos (
  tenant_id, projeto_id, cliente_id,
  template, valor, pdf_url, data_pagamento,
  status, origem, external_ref
)
SELECT
  re.tenant_id, re.projeto_id, re.cliente_id,
  'legado', re.valor, re.pdf_path,
  re.created_at::date, 'emitido',
  'migrado_recibos_emitidos', re.id::text
FROM public.recibos_emitidos re
WHERE NOT EXISTS (
  SELECT 1 FROM public.recibos r
  WHERE r.origem = 'migrado_recibos_emitidos'
  AND r.external_ref = re.id::text
);

-- Depreciação de tabelas
ALTER TABLE public.pagamentos RENAME TO _deprecated_pagamentos;
ALTER TABLE public.recibos_emitidos RENAME TO _deprecated_recibos_emitidos;