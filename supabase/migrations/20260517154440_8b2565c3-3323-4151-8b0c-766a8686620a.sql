CREATE OR REPLACE FUNCTION public.check_documentos_completos(
  p_projeto_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_deal_id UUID;
  v_has_id BOOLEAN;
  v_has_address BOOLEAN;
  v_has_bill BOOLEAN;
BEGIN
  -- Buscar o deal_id associado ao projeto
  SELECT id INTO v_deal_id FROM public.deals WHERE projeto_id = p_projeto_id LIMIT 1;
  
  -- Se não houver deal, não podemos validar documentos por essa lógica
  IF v_deal_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Verificar Identidade (RG/CNH)
  SELECT EXISTS (
    SELECT 1 FROM public.project_documents 
    WHERE projeto_id = p_projeto_id 
    AND (categoria ILIKE '%identidade%' OR categoria ILIKE '%rg%' OR categoria ILIKE '%cnh%' OR file_name ILIKE '%identidade%')
    AND is_deleted IS NOT TRUE
  ) OR EXISTS (
    SELECT 1 FROM public.deal_custom_field_values v
    JOIN public.deal_custom_fields f ON f.id = v.field_id
    WHERE v.deal_id = v_deal_id 
    AND f.field_key = 'cap_identidade'
    AND v.value_text IS NOT NULL AND v.value_text != '[]'
  ) INTO v_has_id;

  -- 2. Verificar Comprovante de Endereço / Conta de Energia (Muitas vezes são o mesmo documento UC.jpg)
  SELECT EXISTS (
    SELECT 1 FROM public.project_documents 
    WHERE projeto_id = p_projeto_id 
    AND (categoria ILIKE '%endereço%' OR categoria ILIKE '%residencia%' OR categoria ILIKE '%energia%' OR file_name ILIKE '%UC%')
    AND is_deleted IS NOT TRUE
  ) OR EXISTS (
    SELECT 1 FROM public.deal_custom_field_values v
    JOIN public.deal_custom_fields f ON f.id = v.field_id
    WHERE v.deal_id = v_deal_id 
    AND f.field_key = 'cap_comprovante_endereco'
    AND v.value_text IS NOT NULL AND v.value_text != '[]'
  ) INTO v_has_address;

  -- 3. Verificar especificamente Fatura/Conta de Energia (Obrigatório para homologação)
  SELECT EXISTS (
    SELECT 1 FROM public.project_documents 
    WHERE projeto_id = p_projeto_id 
    AND (categoria ILIKE '%conta%' OR categoria ILIKE '%energia%' OR categoria ILIKE '%fatura%' OR file_name ILIKE '%UC%')
    AND is_deleted IS NOT TRUE
  ) INTO v_has_bill;

  RETURN v_has_id AND v_has_address AND v_has_bill;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-executar a atualização da função operacional para garantir o search_path
CREATE OR REPLACE FUNCTION public.get_project_operational_data(_deal_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_projeto_id UUID;
    result JSONB;
BEGIN
    SELECT projeto_id INTO v_projeto_id FROM public.deals WHERE id = _deal_id;

    SELECT jsonb_build_object(
        'deal', (
            SELECT jsonb_build_object(
                'status', d.status, 
                'doc_checklist', d.doc_checklist,
                'docs_completos', public.check_documentos_completos(d.projeto_id)
            ) 
            FROM public.deals d WHERE d.id = _deal_id
        ),
        'activation', (SELECT jsonb_build_object('id', id, 'data_ativacao', data_ativacao) FROM public.projeto_ativacao WHERE projeto_id = v_projeto_id LIMIT 1),
        'vistoria', (SELECT jsonb_build_object('status', status, 'resultado', resultado) FROM public.projeto_vistoria WHERE projeto_id = v_projeto_id LIMIT 1),
        'homologacao', (SELECT jsonb_build_object('status', status) FROM public.projeto_homologacao WHERE projeto_id = v_projeto_id LIMIT 1),
        'checklists', (SELECT jsonb_agg(jsonb_build_object('status', status)) FROM public.checklists_instalador WHERE projeto_id = v_projeto_id AND status != 'cancelado'),
        'os_instalacao', (SELECT jsonb_agg(jsonb_build_object('status', status, 'data_agendada', data_agendada)) FROM public.os_instalacao WHERE projeto_id = v_projeto_id AND status != 'cancelada')
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;