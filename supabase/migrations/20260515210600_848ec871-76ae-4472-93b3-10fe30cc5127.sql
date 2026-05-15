CREATE OR REPLACE FUNCTION public.get_project_operational_data(_deal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'deal', (SELECT jsonb_build_object('status', status, 'doc_checklist', doc_checklist) FROM deals WHERE id = _deal_id),
        'activation', (SELECT jsonb_build_object('id', id, 'data_ativacao', data_ativacao) FROM projeto_ativacao WHERE projeto_id = _deal_id LIMIT 1),
        'vistoria', (SELECT jsonb_build_object('status', status, 'resultado', resultado) FROM projeto_vistoria WHERE projeto_id = _deal_id LIMIT 1),
        'homologacao', (SELECT jsonb_build_object('status', status) FROM projeto_homologacao WHERE projeto_id = _deal_id LIMIT 1),
        'checklists', (SELECT jsonb_agg(jsonb_build_object('status', status)) FROM checklists_instalador WHERE projeto_id = _deal_id AND status != 'cancelado'),
        'os_instalacao', (SELECT jsonb_agg(jsonb_build_object('status', status, 'data_agendada', data_agendada)) FROM os_instalacao WHERE projeto_id = _deal_id AND status != 'cancelada')
    ) INTO result;

    RETURN result;
END;
$$;