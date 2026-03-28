ALTER TABLE public.proposta_aceite_tokens
  ADD COLUMN IF NOT EXISTS forma_pagamento_escolhida JSONB;

COMMENT ON COLUMN public.proposta_aceite_tokens.forma_pagamento_escolhida
  IS 'Forma de pagamento escolhida pelo cliente ao aceitar. JSON: {tipo, forma_id?, forma_nome?, num_parcelas?, valor_parcela?, banco_nome?}';