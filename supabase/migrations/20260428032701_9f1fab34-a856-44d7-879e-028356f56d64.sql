
INSERT INTO sm_custom_field_mapping (tenant_id, sm_field_key, action, crm_field_id)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41','capo_desconto','map','71314377-4752-4d95-9d23-874545bfedea'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41','capo_seguro','map','2098b8b3-e576-4614-966a-f8a2531cdc0c'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41','capo_string_box','map','e7f4110e-5058-46f9-b8a5-312be436c7d5'),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41','capo_overlord','ignore',NULL)
ON CONFLICT (tenant_id, sm_field_key) DO UPDATE
SET action=EXCLUDED.action, crm_field_id=EXCLUDED.crm_field_id;
