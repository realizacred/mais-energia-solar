UPDATE public.deal_custom_fields
SET is_active = false,
    updated_at = now()
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND field_key IN ('pos_inversor_qtd', 'pos_modulo_info')
  AND field_context = 'pos_dimensionamento';