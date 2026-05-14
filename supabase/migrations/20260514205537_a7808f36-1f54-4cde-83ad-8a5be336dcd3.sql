-- Função para avançar etapa ao aprovar crédito
CREATE OR REPLACE FUNCTION public.handle_credit_approval_automation()
RETURNS TRIGGER AS $$
DECLARE
    v_membership RECORD;
    v_next_stage_id UUID;
    v_next_stage_name TEXT;
    v_current_stage_name TEXT;
BEGIN
    -- Só dispara se o status mudou para 'aprovado'
    IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') AND NEW.deal_id IS NOT NULL THEN
        
        -- Busca memberships técnicos
        FOR v_membership IN 
            SELECT 
                dps.id,
                dps.stage_id,
                dps.pipeline_id,
                p.name as pipeline_name
            FROM public.deal_pipeline_stages dps
            JOIN public.pipelines p ON p.id = dps.pipeline_id
            WHERE dps.deal_id = NEW.deal_id
            AND (LOWER(p.name) LIKE '%engenharia%' OR LOWER(p.name) LIKE '%instalação%' OR LOWER(p.name) LIKE '%execução%')
        LOOP
            -- Busca a próxima etapa
            SELECT id, name INTO v_next_stage_id, v_next_stage_name
            FROM public.pipeline_stages
            WHERE pipeline_id = v_membership.pipeline_id
            AND position > (SELECT position FROM public.pipeline_stages WHERE id = v_membership.stage_id)
            ORDER BY position ASC
            LIMIT 1;

            -- Se encontrou uma próxima etapa, realiza a transição
            IF v_next_stage_id IS NOT NULL THEN
                
                -- Salva nome da etapa atual
                SELECT name INTO v_current_stage_name FROM public.pipeline_stages WHERE id = v_membership.stage_id;

                -- Atualiza a etapa
                UPDATE public.deal_pipeline_stages 
                SET stage_id = v_next_stage_id 
                WHERE id = v_membership.id;

                -- Registra no histórico
                INSERT INTO public.project_events (
                    tenant_id,
                    deal_id,
                    event_type,
                    from_value,
                    to_value,
                    actor_user_id,
                    metadata
                ) VALUES (
                    NEW.tenant_id,
                    NEW.deal_id,
                    'stage_changed',
                    COALESCE(v_current_stage_name, 'Anterior'),
                    v_next_stage_name,
                    NEW.updated_at, -- Usando updated_at como timestamp aproximado do ator
                    jsonb_build_object(
                        'reason', 'Aprovação de Crédito (' || COALESCE(NEW.banco, 'Banco') || ')',
                        'membership_id', v_membership.id,
                        'pipeline_name', v_membership.pipeline_name,
                        'automation', true
                    )
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para automação de crédito
DROP TRIGGER IF EXISTS tr_credit_approval_automation ON public.analise_credito;
CREATE TRIGGER tr_credit_approval_automation
AFTER UPDATE ON public.analise_credito
FOR EACH ROW
EXECUTE FUNCTION public.handle_credit_approval_automation();
