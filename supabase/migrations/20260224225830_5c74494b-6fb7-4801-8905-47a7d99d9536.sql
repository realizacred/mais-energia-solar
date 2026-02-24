
-- Populate Disjuntor custom field options from disjuntores table
UPDATE deal_custom_fields 
SET options = (
  SELECT jsonb_agg(descricao ORDER BY amperagem)
  FROM disjuntores 
  WHERE ativo = true 
  AND disjuntores.tenant_id = deal_custom_fields.tenant_id
)
WHERE field_key = 'cap_disjuntor' AND is_active = true;

-- Populate Transformador custom field options from transformadores table
UPDATE deal_custom_fields 
SET options = (
  SELECT jsonb_agg(descricao ORDER BY potencia_kva)
  FROM transformadores 
  WHERE ativo = true 
  AND transformadores.tenant_id = deal_custom_fields.tenant_id
)
WHERE field_key = 'cap_transformador' AND is_active = true;
