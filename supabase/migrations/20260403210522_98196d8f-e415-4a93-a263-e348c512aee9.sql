-- Fix tenant_id for financiamento_bancos (wrong tenant)
UPDATE financiamento_bancos 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Fix tenant_id for proposta_templates DOCX (wrong tenant)
UPDATE proposta_templates 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Fix template "Moderno & Limpo" that belongs to wrong tenant
UPDATE proposta_templates 
SET tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
WHERE id = '6ffa3f12-cc35-4d45-9e72-3c95a1755f88'
AND tenant_id = '58ac9830-845e-4bfd-9f2f-258be568ef14';