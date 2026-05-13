INSERT INTO sm_custom_field_mapping (tenant_id, sm_field_key, action, crm_field_id, crm_field_type)
VALUES ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cap_documentos', 'map', 'dba87a5d-ea8c-418f-8172-76be694fb610', 'file')
ON CONFLICT DO NOTHING;