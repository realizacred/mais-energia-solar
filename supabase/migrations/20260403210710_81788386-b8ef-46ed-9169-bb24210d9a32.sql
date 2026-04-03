-- Fix ALL remaining records with wrong tenant_id
-- Target: 00000000-0000-0000-0000-000000000001 → 17de8315-2e2f-4a79-8751-e5d507d69a41

-- integration_configs (7 records: openai, meta, gemini, asaas)
UPDATE integration_configs 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- calculadora_config (1 record)
UPDATE calculadora_config 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- brand_settings (1 record)
UPDATE brand_settings 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- checklist_templates (2 records)
UPDATE checklist_templates 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';