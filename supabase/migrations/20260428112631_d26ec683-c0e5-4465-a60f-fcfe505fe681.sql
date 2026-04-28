-- Criar campo customizado Overlord no contexto pos_dimensionamento
-- Conforme decisão do usuário no mapeamento SM (sm_field_key: capo_overlord → pos_overlord)
WITH novo_campo AS (
  INSERT INTO public.deal_custom_fields (
    tenant_id, title, field_key, field_type, field_context,
    options, ordem, is_active
  ) VALUES (
    '17de8315-2e2f-4a79-8751-e5d507d69a41',
    'Overlord',
    'overlord',
    'select',
    'pos_dimensionamento',
    '[]'::jsonb,
    999,
    true
  )
  RETURNING id
)
-- Atualiza a linha de mapeamento create_new (sm_field_key com colchetes) para apontar ao novo campo
UPDATE public.sm_custom_field_mapping m
SET crm_field_id = (SELECT id FROM novo_campo),
    updated_at = now()
WHERE m.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND m.sm_field_key = '[capo_overlord]'
  AND m.action = 'create_new';

-- Remover linha duplicada/conflitante com action='ignore' para evitar que o promoter descarte os valores
DELETE FROM public.sm_custom_field_mapping
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_field_key = 'capo_overlord'
  AND action = 'ignore';

-- Normalizar a chave do mapeamento remanescente (remover colchetes) para casar com staging
UPDATE public.sm_custom_field_mapping
SET sm_field_key = 'capo_overlord',
    updated_at = now()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_field_key = '[capo_overlord]';