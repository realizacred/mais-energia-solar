-- 1) Marcar slugs SM como 'ignore' ANTES de soltar a FK (cascade SET NULL exige action!='map')
UPDATE sm_custom_field_mapping
   SET action = 'ignore', crm_field_id = NULL
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND sm_field_key IN ('capo_mi','capo_observacoes');

-- 2) Apagar valores
DELETE FROM deal_custom_field_values
 WHERE field_id IN (
   'b804df26-a530-4c13-aec8-a65425296968',
   'f3430c4a-c1d2-448e-9de4-0fb4f925bb31'
 );

-- 3) Apagar definições
DELETE FROM deal_custom_fields
 WHERE id IN (
   'b804df26-a530-4c13-aec8-a65425296968',
   'f3430c4a-c1d2-448e-9de4-0fb4f925bb31'
 );