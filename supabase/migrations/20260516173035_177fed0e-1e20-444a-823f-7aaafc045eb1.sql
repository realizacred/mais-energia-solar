CREATE OR REPLACE FUNCTION public.get_system_integrity_findings()
 RETURNS TABLE(id text, tenant_id uuid, domain text, severity text, entity_type text, entity_id uuid, title text, description text, recommended_action text, detected_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := get_user_tenant_id();
    
    -- 1. PROJEÇÕES (Divergência entre fonte canônica e projection)
    RETURN QUERY
    SELECT 
        'proj_drift_' || d.id::text,
        v_tenant_id,
        'projections',
        'critical',
        'deal',
        d.id,
        'Divergência de valor em projeção',
        'O valor real do Deal (R$ ' || d.value || ') diverge da projeção financeira (R$ ' || dfp.total_value || ').',
        'Forçar resincronização do deal.',
        now()
    FROM public.deals d
    JOIN public.deal_financial_projection dfp ON dfp.deal_id = d.id
    WHERE d.tenant_id = v_tenant_id AND ABS(d.value - dfp.total_value) > 0.01;

    RETURN QUERY
    SELECT 
        'proj_missing_' || p.id::text,
        v_tenant_id,
        'projections',
        'warning',
        'projeto',
        p.id,
        'Projeção operacional ausente',
        'O projeto existe mas não possui registro na camada de projeção operacional.',
        'Atualizar o status do projeto para disparar trigger.',
        now()
    FROM public.projetos p
    LEFT JOIN public.project_operational_projection pop ON pop.project_id = p.id
    WHERE p.tenant_id = v_tenant_id AND pop.project_id IS NULL;

    -- 2. PROPOSTAS (Regras de negócio e PDFs)
    RETURN QUERY
    SELECT 
        'prop_multi_main_' || pr.id::text,
        v_tenant_id,
        'propostas',
        'critical',
        'projeto',
        pr.id,
        'Múltiplas propostas principais',
        'O projeto possui mais de uma proposta marcada como principal/aceita simultaneamente.',
        'Revisar propostas e desmarcar duplicatas.',
        now()
    FROM public.projetos pr
    WHERE pr.tenant_id = v_tenant_id 
    AND (SELECT count(*) FROM public.propostas_nativas WHERE projeto_id = pr.id AND status = 'aceita') > 1;

    RETURN QUERY
    SELECT 
        'prop_no_pdf_' || pv.id::text,
        v_tenant_id,
        'propostas',
        'warning',
        'proposta_versao',
        pv.id,
        'Versão oficial sem PDF',
        'Uma versão de proposta marcada como oficial não possui caminho de arquivo PDF registrado.',
        'Gerar PDF novamente para esta versão.',
        now()
    FROM public.proposta_versoes pv
    JOIN public.propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = v_tenant_id AND pv.is_official = true AND (pv.output_pdf_path IS NULL OR pv.output_pdf_path = '');

    -- 3. FINANCEIRO (Conciliação e órfãos)
    RETURN QUERY
    SELECT 
        'fin_orphan_rec_' || r.id::text,
        v_tenant_id,
        'financeiro',
        'critical',
        'recebimento',
        r.id,
        'Recebimento sem projeto vinculado',
        'Existe um registro de recebimento que não aponta para nenhum projeto ou deal.',
        'Vincular o recebimento a um contrato real.',
        now()
    FROM public.recebimentos r
    WHERE r.tenant_id = v_tenant_id AND r.projeto_id IS NULL;

    -- 4. WHATSAPP (Fila e Webhooks)
    RETURN QUERY
    SELECT 
        'wa_stale_outbox_' || o.id::text,
        v_tenant_id,
        'whatsapp',
        'warning',
        'wa_outbox',
        o.id,
        'Mensagem presa no outbox',
        'Mensagem em estado "pending" ou "sending" há mais de 2 horas.',
        'Reiniciar instância ou limpar outbox.',
        now()
    FROM public.wa_outbox o
    WHERE o.tenant_id = v_tenant_id 
    AND o.status IN ('pending', 'sending') 
    AND o.created_at < now() - interval '2 hours';

    -- 5. JOBS / QUEUE (Retries e Dead-letter)
    RETURN QUERY
    SELECT 
        'job_failed_' || q.id::text,
        v_tenant_id,
        'jobs',
        'warning',
        'job',
        q.id,
        'Job com excesso de retries',
        'O processamento falhou repetidamente (' || q.retry_count || ' tentativas).',
        'Verificar logs de erro do job.',
        now()
    FROM public.enterprise_job_queue q
    WHERE q.tenant_id = v_tenant_id AND q.retry_count >= 3 AND q.status != 'completed';

    -- 6. TIMELINE (Eventos órfãos)
    RETURN QUERY
    SELECT 
        'time_orphan_' || e.id::text,
        v_tenant_id,
        'timeline',
        'info',
        'timeline_event',
        e.id,
        'Evento de timeline órfão',
        'Evento registrado sem ID de projeto ou deal associado.',
        'Verificar origem do evento.',
        now()
    FROM public.project_timeline_events e
    WHERE e.tenant_id = v_tenant_id AND e.project_id IS NULL;

END;
$function$;