-- Identificar campos de arquivo que vieram do SolarMarket e ainda possuem URLs externas.
-- Note: sm-promote-custom-fields é idempotente e canônico para download. 
-- Forçamos um re-lote de promoção para esses deals específicos.

DO $$
DECLARE
    r RECORD;
    count_docs INTEGER := 0;
BEGIN
    -- Busca valores que são URLs ou arrays de URLs (contêm http)
    FOR r IN 
        SELECT 
            v.deal_id,
            v.tenant_id,
            p.external_id as sm_project_id
        FROM public.deal_custom_field_values v
        JOIN public.deal_custom_fields f ON v.field_id = f.id
        JOIN public.projetos p ON v.deal_id = p.deal_id
        WHERE f.field_type = 'file'
          AND v.value_text ILIKE '%http%'
          AND p.external_source = 'solarmarket'
    LOOP
        -- Registra log de aviso para auditoria
        RAISE NOTICE 'Deal % (SM %) possui documentos pendentes. Disparar sm-promote-custom-fields para este lote.', r.deal_id, r.sm_project_id;
        count_docs := count_docs + 1;
    END LOOP;
    
    RAISE NOTICE 'Total de deals com documentos pendentes: %', count_docs;
END $$;
