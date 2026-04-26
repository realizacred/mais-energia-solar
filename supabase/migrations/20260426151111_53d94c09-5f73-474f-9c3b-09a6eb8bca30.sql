UPDATE public.sm_custom_field_mapping m
SET
  sm_field_label = COALESCE(scf.payload->>'name', m.sm_field_label),
  sm_field_type  = COALESCE(scf.payload->>'type', m.sm_field_type),
  updated_at     = now()
FROM public.sm_custom_fields_raw scf
WHERE m.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
  AND scf.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
  AND trim(both '[]' from scf.payload->>'key') = m.sm_field_key;