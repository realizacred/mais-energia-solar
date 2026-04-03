-- Seed payment_interest_config with default payment methods for the tenant
INSERT INTO payment_interest_config (tenant_id, forma_pagamento, juros_tipo, juros_valor, juros_responsavel, parcelas_padrao, intervalo_dias_padrao, ativo, observacoes)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'pix', 'sem_juros', 0, 'nao_aplica', 1, 0, true, 'Pagamento imediato'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'dinheiro', 'sem_juros', 0, 'nao_aplica', 1, 0, true, 'Pagamento em espécie'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'transferencia', 'sem_juros', 0, 'nao_aplica', 1, 0, true, 'TED/DOC'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'boleto', 'sem_juros', 0, 'nao_aplica', 3, 30, true, 'Boleto bancário'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cartao_credito', 'percentual', 2.99, 'cliente', 12, 30, true, 'Cartão de crédito parcelado'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cartao_debito', 'sem_juros', 0, 'nao_aplica', 1, 0, true, 'Cartão de débito'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cheque', 'sem_juros', 0, 'nao_aplica', 3, 30, true, 'Cheque à prazo')
ON CONFLICT (tenant_id, forma_pagamento) DO NOTHING;