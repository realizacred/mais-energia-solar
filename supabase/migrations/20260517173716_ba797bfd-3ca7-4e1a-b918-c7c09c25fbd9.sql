CREATE OR REPLACE FUNCTION public.get_project_operational_data(_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 AS $function$
DECLARE
    v_projeto_id UUID;
    result JSONB;
BEGIN
    -- Get the projeto_id associated with the deal
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
        'projeto', (
            SELECT jsonb_build_object(
                'funil_nome', pf.nome,
                'etapa_nome', pe.nome
            )
            FROM public.projetos p
            LEFT JOIN public.projeto_funis pf ON pf.id = p.funil_id
            LEFT JOIN public.projeto_etapas pe ON pe.id = p.etapa_id
            WHERE p.id = v_projeto_id
        ),
        'memberships', (
            SELECT jsonb_agg(jsonb_build_object(
                'pipeline_name', pf.name,
                'stage_name', ps.name
            ))
            FROM public.deal_pipeline_stages dps
            JOIN public.pipelines pf ON pf.id = dps.pipeline_id
            JOIN public.pipeline_stages ps ON ps.id = dps.stage_id
            WHERE dps.deal_id = _deal_id
        ),
        'activation', (SELECT jsonb_build_object('id', id, 'data_ativacao', data_ativacao) FROM public.projeto_ativacao WHERE projeto_id = v_projeto_id LIMIT 1),
        'vistoria', (SELECT jsonb_build_object('status', status, 'resultado', resultado) FROM public.projeto_vistoria WHERE projeto_id = v_projeto_id LIMIT 1),
        'homologacao', (SELECT jsonb_build_object('status', status) FROM public.projeto_homologacao WHERE projeto_id = v_projeto_id LIMIT 1),
        'checklists', (SELECT jsonb_agg(jsonb_build_object('status', status)) FROM public.checklists_instalador WHERE projeto_id = v_projeto_id AND status != 'cancelado'),
        'os_instalacao', (SELECT jsonb_agg(jsonb_build_object('status', status, 'data_agendada', data_agendada)) FROM public.os_instalacao WHERE projeto_id = v_projeto_id AND status != 'cancelada')
    ) INTO result;

    RETURN result;
END;
$function$;