UPDATE public.pipeline_stage_validations 
SET aplicar_a_partir = true, 
    mensagem_bloqueio = 'Vincule um fornecedor antes de avançar',
    bloquear_avanco = true
WHERE stage_id = 'b3fe8902-69f1-4b58-b60c-64b1e795bf88' 
  AND tipo_validacao = 'fornecedor_vinculado';