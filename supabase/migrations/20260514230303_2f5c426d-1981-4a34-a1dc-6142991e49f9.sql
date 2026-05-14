-- Trigger para automação de etapa baseada em documentos dinâmicos
CREATE OR REPLACE FUNCTION public.fn_document_stage_automation()
RETURNS TRIGGER AS $$
DECLARE
    r_regra RECORD;
    v_target_membership_id UUID;
    v_pipeline_id UUID;
    v_etapa_atual_id UUID;
BEGIN
    -- Busca se existe alguma regra ativa para esta categoria de documento neste tenant
    -- Priorizamos regras específicas para a etapa atual do projeto
    
    -- 1. Identificar o pipeline e etapa atual do projeto para este documento
    -- O documento está ligado a um deal. Precisamos ver em quais memberships de pipeline esse deal está.
    FOR v_pipeline_id, v_etapa_atual_id, v_target_membership_id IN 
        SELECT pipeline_id, stage_id, id 
        FROM public.deal_pipeline_stages 
        WHERE deal_id = NEW.deal_id
    LOOP
        -- 2. Procurar regra que combine:
        -- - Tipo: documento_anexado
        -- - Categoria (dentro do JSONB condicao): NEW.categoria
        -- - Pipeline: v_pipeline_id
        -- - Etapa origem: v_etapa_atual_id OU NULL (qualquer etapa)
        
        SELECT * INTO r_regra
        FROM public.funil_automacoes
        WHERE tenant_id = NEW.tenant_id
          AND pipeline_id = v_pipeline_id
          AND ativo = true
          AND tipo = 'documento_anexado'
          AND (etapa_origem_id = v_etapa_atual_id OR etapa_origem_id IS NULL)
          AND (condicao->>'categoria' = NEW.categoria)
        LIMIT 1;

        IF r_regra.id IS NOT NULL THEN
            -- 3. Executar a transição
            UPDATE public.deal_pipeline_stages
            SET stage_id = r_regra.etapa_destino_id,
                updated_at = now()
            WHERE id = v_target_membership_id;
            
            -- Opcional: Registrar no histórico ou logs
            -- INSERT INTO public.automation_history ...
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar a trigger na tabela project_documents
DROP TRIGGER IF EXISTS tr_document_stage_automation ON public.project_documents;
CREATE TRIGGER tr_document_stage_automation
    AFTER INSERT ON public.project_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_document_stage_automation();