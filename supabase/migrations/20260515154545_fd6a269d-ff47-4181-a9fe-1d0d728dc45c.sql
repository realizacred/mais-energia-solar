
-- Atualizar view para usar security_invoker=on (padrão de segurança Lovable)
CREATE OR REPLACE VIEW public.vw_receitas_canonicas 
WITH (security_invoker=on) AS
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
