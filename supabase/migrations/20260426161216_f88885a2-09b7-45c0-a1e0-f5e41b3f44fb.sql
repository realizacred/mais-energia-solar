-- Seed de sugestões de mapeamento native para garantias e telhado.
-- Idempotente: ON CONFLICT DO NOTHING (chave: tenant_id + sm_field_key).

INSERT INTO public.sm_custom_field_mapping
  (tenant_id, sm_field_key, sm_field_label, sm_field_type, action, crm_native_target)
SELECT
  t.id,
  v.sm_field_key,
  v.sm_field_label,
  v.sm_field_type,
  'map_native',
  v.crm_native_target
FROM public.tenants t
CROSS JOIN (VALUES
  ('cape_telhado', 'Tipo de Telhado',          'selectbox', 'snapshot.tipo_telhado'),
  ('capo_m',       'Garantia Módulo',          'text',      'snapshot.garantias.modulo_sm'),
  ('capo_i',       'Garantia Inversor',        'text',      'snapshot.garantias.inversor_sm'),
  ('capo_mi',      'Garantia Microinversor',   'text',      'snapshot.garantias.microinversor_sm')
) AS v(sm_field_key, sm_field_label, sm_field_type, crm_native_target)
WHERE EXISTS (
  -- só pré-popula se o tenant tem dados SolarMarket no staging
  SELECT 1 FROM public.sm_custom_fields_raw r WHERE r.tenant_id = t.id
)
ON CONFLICT (tenant_id, sm_field_key) DO NOTHING;