CREATE INDEX IF NOT EXISTS idx_smp_tenant_migrado_pending 
ON public.solar_market_proposals (tenant_id, sm_proposal_id) 
WHERE migrado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_smp_tenant_migrado_done 
ON public.solar_market_proposals (tenant_id) 
WHERE migrado_em IS NOT NULL;