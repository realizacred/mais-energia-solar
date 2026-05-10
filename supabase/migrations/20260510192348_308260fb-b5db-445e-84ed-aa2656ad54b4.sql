CREATE OR REPLACE FUNCTION public.audit_sm_migration(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_total_staging INTEGER;
    v_promoted_propostas INTEGER;
    v_orphaned_propostas INTEGER;
    v_orphaned_projetos INTEGER;
    v_duplicate_links INTEGER;
    v_broken_links INTEGER;
BEGIN
    -- Total staging
    SELECT count(*) INTO v_total_staging FROM sm_propostas_raw WHERE tenant_id = p_tenant_id;
    
    -- Promoted propostas
    SELECT count(*) INTO v_promoted_propostas 
    FROM external_entity_links 
    WHERE tenant_id = p_tenant_id AND entity_type = 'proposta' AND source = 'solarmarket';
    
    -- Propostas sem projeto (na tabela de propostas real, verificando se o projeto_id é nulo)
    SELECT count(*) INTO v_orphaned_propostas
    FROM propostas p
    JOIN external_entity_links eel ON eel.entity_id = p.id
    WHERE p.tenant_id = p_tenant_id 
      AND eel.entity_type = 'proposta' 
      AND eel.source = 'solarmarket'
      AND p.projeto_id IS NULL;
      
    -- Projetos sem cliente
    SELECT count(*) INTO v_orphaned_projetos
    FROM projetos pr
    JOIN external_entity_links eel ON eel.entity_id = pr.id
    WHERE pr.tenant_id = p_tenant_id 
      AND eel.entity_type = 'projeto' 
      AND eel.source = 'solarmarket'
      AND pr.cliente_id IS NULL;

    -- Duplicidades de links (mesma source_entity_id linkada a multiplas entidades locais)
    SELECT count(*) INTO v_duplicate_links
    FROM (
        SELECT source_entity_id, source_entity_type, count(*)
        FROM external_entity_links
        WHERE tenant_id = p_tenant_id AND source = 'solarmarket'
        GROUP BY source_entity_id, source_entity_type
        HAVING count(*) > 1
    ) as dups;

    -- Links quebrados (eel aponta para um ID que não existe na tabela destino)
    -- Simplificado: verifica apenas propostas
    SELECT count(*) INTO v_broken_links
    FROM external_entity_links eel
    LEFT JOIN propostas p ON p.id = eel.entity_id
    WHERE eel.tenant_id = p_tenant_id 
      AND eel.entity_type = 'proposta' 
      AND eel.source = 'solarmarket'
      AND p.id IS NULL;

    v_result := jsonb_build_object(
        'total_staging', v_total_staging,
        'promoted_propostas', v_promoted_propostas,
        'remaining', v_total_staging - v_promoted_propostas,
        'orphaned_propostas', v_orphaned_propostas,
        'orphaned_projetos', v_orphaned_projetos,
        'duplicate_links', v_duplicate_links,
        'broken_links', v_broken_links,
        'status', CASE WHEN v_total_staging = v_promoted_propostas THEN 'concluded' ELSE 'in_progress' END,
        'timestamp', now()
    );

    RETURN v_result;
END;
$$;
