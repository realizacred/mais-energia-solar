INSERT INTO public.sm_custom_field_mapping (tenant_id, sm_field_key, sm_field_label, sm_field_type, action, crm_field_id)
VALUES ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'capo_tempogarantia', 'Tempo de garantia (legado SM)', 'text', 'ignore', NULL)
ON CONFLICT DO NOTHING;