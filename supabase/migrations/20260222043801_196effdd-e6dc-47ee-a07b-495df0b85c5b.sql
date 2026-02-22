
-- Add 'file' to the field_type check constraint
ALTER TABLE public.deal_custom_fields DROP CONSTRAINT deal_custom_fields_field_type_check;
ALTER TABLE public.deal_custom_fields ADD CONSTRAINT deal_custom_fields_field_type_check 
  CHECK (field_type = ANY (ARRAY['text','number','date','select','boolean','currency','textarea','file']));

-- Insert the 8 custom fields
INSERT INTO public.deal_custom_fields (tenant_id, title, field_key, field_type, field_context, ordem, show_on_create, required_on_create, visible_on_funnel, important_on_funnel, required_on_funnel, is_active, options)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Identidade', 'cap_identidade', 'file', 'projeto', 1, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Comprovante Endereço', 'cap_comprovante_endereco', 'file', 'projeto', 2, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Wi-Fi', 'cap_wifi', 'textarea', 'projeto', 3, true, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Equipamento', 'cap_equipamento', 'textarea', 'projeto', 4, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Disjuntor', 'cap_disjuntor', 'select', 'projeto', 5, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Localização', 'cap_localizacao', 'textarea', 'projeto', 6, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Transformador', 'cap_transformador', 'select', 'projeto', 7, false, false, true, true, true, true, null),
  ('00000000-0000-0000-0000-000000000001', 'Observações', 'cap_obs', 'text', 'projeto', 8, false, false, true, false, false, true, null);
