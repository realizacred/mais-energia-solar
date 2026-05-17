-- Inserindo validação de fornecedor vinculado para a etapa "Pedido Efetuado"
INSERT INTO public.pipeline_stage_validations (tenant_id, stage_id, tipo_validacao, configuracao, mensagem_bloqueio, bloquear_avanco)
VALUES (
  '17de8315-2e2f-4a79-8751-e5d507d69a41', 
  'b3fe8902-69f1-4b58-b60c-64b1e795bf88', 
  'fornecedor_vinculado', 
  '{"label": "Fornecedor vinculado"}'::jsonb, 
  'Registre o fornecedor em "Pedido Efetuado" antes de avançar.', 
  true
) ON CONFLICT DO NOTHING;

-- Inserindo validação de fornecedor vinculado para a etapa "Pedido Pago"
INSERT INTO public.pipeline_stage_validations (tenant_id, stage_id, tipo_validacao, configuracao, mensagem_bloqueio, bloquear_avanco)
VALUES (
  '17de8315-2e2f-4a79-8751-e5d507d69a41', 
  'ded96298-e309-4546-bf48-433282e9c5fa', 
  'fornecedor_vinculado', 
  '{"label": "Fornecedor vinculado"}'::jsonb, 
  'Registre o fornecedor em "Pedido Efetuado" antes de avançar.', 
  true
) ON CONFLICT DO NOTHING;
