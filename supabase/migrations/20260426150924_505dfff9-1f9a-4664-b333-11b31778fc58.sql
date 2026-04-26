-- Enriquece labels/types do seed lendo do shape real de sm_custom_fields_raw:
--   payload->'key'->>0 → slug
--   payload->>'name'   → label amigável
--   payload->>'type'   → tipo (text, selectbox, file, textarea, money, ...)
UPDATE public.sm_custom_field_mapping m
SET
  sm_field_label = COALESCE(scf.payload->>'name', m.sm_field_label),
  sm_field_type  = COALESCE(scf.payload->>'type', m.sm_field_type),
  updated_at     = now()
FROM public.sm_custom_fields_raw scf
WHERE m.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
  AND scf.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
  AND scf.payload->'key'->>0 = m.sm_field_key;