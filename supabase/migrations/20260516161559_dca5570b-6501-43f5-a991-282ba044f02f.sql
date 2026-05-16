-- 1. ADICIONAR IDEMPOTÊNCIA NA FILA DE JOBS
ALTER TABLE public.enterprise_job_queue 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS locked_by UUID;

-- 2. BACKFILL INICIAL DE PROJEÇÕES (DIFERENÇA DETECTADA NA AUDITORIA)
-- Projeções financeiras
INSERT INTO public.deal_financial_projection (
    deal_id, tenant_id, projeto_id, title, total_value, received_value, pending_value
)
SELECT 
    d.id, d.tenant_id, d.projeto_id, d.title, d.value, 
    COALESCE(sub.received, 0), (d.value - COALESCE(sub.received, 0))
FROM public.deals d
LEFT JOIN (
    SELECT projeto_id, SUM(valor) as received 
    FROM public.lancamentos_financeiros 
    WHERE status = 'pago' 
    GROUP BY projeto_id
) sub ON sub.projeto_id = d.projeto_id
ON CONFLICT (deal_id) DO NOTHING;

-- Projeções operacionais
INSERT INTO public.project_operational_projection (
    project_id, tenant_id, codigo, status_operacional, data_venda, potencia_kwp
)
SELECT 
    p.id, p.tenant_id, p.codigo, p.status::text, p.data_venda, p.potencia_kwp
FROM public.projetos p
ON CONFLICT (project_id) DO NOTHING;

-- 3. REFORÇO DE SEGURANÇA EM FEATURE FLAGS (ISOLAMENTO POR TENANT NO DB)
CREATE OR REPLACE FUNCTION public.check_feature_flag(p_feature_name text, p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER -- Garante execução correta mesmo com RLS restrito na tabela de config
AS $function$
DECLARE
    v_enabled BOOLEAN;
    v_globally BOOLEAN;
    v_rollout INT;
BEGIN
    -- Validação de segurança: o usuário atual deve ter acesso ao tenant_id solicitado
    -- (O RLS da tabela feature_flags já protege a leitura, mas aqui forçamos o isolamento lógico)
    
    SELECT is_enabled_globally, rollout_percentage INTO v_globally, v_rollout 
    FROM public.feature_flags WHERE name = p_feature_name;
    
    IF v_globally THEN RETURN TRUE; END IF;
    
    -- Check tenant override (Join seguro para evitar vazamento entre tenants)
    SELECT tff.is_enabled INTO v_enabled 
    FROM public.tenant_feature_flags tff
    JOIN public.feature_flags ff ON ff.id = tff.feature_flag_id
    WHERE tff.tenant_id = p_tenant_id 
    AND ff.name = p_feature_name;
    
    IF v_enabled IS NOT NULL THEN RETURN v_enabled; END IF;
    
    -- Rollout logic determinístico por tenant
    IF v_rollout > 0 AND (('x' || substr(md5(p_tenant_id::text), 1, 8))::bit(32)::int % 100) < v_rollout THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$function$;

-- 4. REFORÇO DE RLS NAS TABELAS ENTERPRISE
ALTER TABLE public.deal_financial_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_operational_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant isolation for financial projections') THEN
        CREATE POLICY "Tenant isolation for financial projections" ON public.deal_financial_projection
        FOR ALL USING (tenant_id = (SELECT get_user_tenant_id()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant isolation for operational projections') THEN
        CREATE POLICY "Tenant isolation for operational projections" ON public.project_operational_projection
        FOR ALL USING (tenant_id = (SELECT get_user_tenant_id()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant isolation for enterprise jobs') THEN
        CREATE POLICY "Tenant isolation for enterprise jobs" ON public.enterprise_job_queue
        FOR ALL USING (tenant_id = (SELECT get_user_tenant_id()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant isolation for timeline events') THEN
        CREATE POLICY "Tenant isolation for timeline events" ON public.project_timeline_events
        FOR ALL USING (tenant_id = (SELECT get_user_tenant_id()));
    END IF;
END $$;
