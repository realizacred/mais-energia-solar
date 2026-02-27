-- ============================================================
-- Wipe all SolarMarket data for fresh re-sync
-- Also drop and recreate the analytics view with lead linking
-- ============================================================

-- 1) Truncate all SM data tables
TRUNCATE TABLE public.solar_market_custom_field_values CASCADE;
TRUNCATE TABLE public.solar_market_proposals CASCADE;
TRUNCATE TABLE public.solar_market_projects CASCADE;
TRUNCATE TABLE public.solar_market_clients CASCADE;
TRUNCATE TABLE public.solar_market_funnel_stages CASCADE;
TRUNCATE TABLE public.solar_market_funnels CASCADE;
TRUNCATE TABLE public.solar_market_custom_fields CASCADE;
TRUNCATE TABLE public.solar_market_sync_logs CASCADE;

-- 2) Add lead_id column to solar_market_clients for cross-linking
ALTER TABLE public.solar_market_clients
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- 3) Add formatted columns to solar_market_clients
ALTER TABLE public.solar_market_clients
  ADD COLUMN IF NOT EXISTS phone_formatted text,
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS zip_code_formatted text,
  ADD COLUMN IF NOT EXISTS document_formatted text;

-- 4) Add formatted columns to solar_market_projects
ALTER TABLE public.solar_market_projects
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS zip_code_formatted text;

-- 5) Drop old analytics view and recreate with lead linking
DROP VIEW IF EXISTS public.sm_analytics_view;

CREATE OR REPLACE VIEW public.sm_analytics_view
WITH (security_invoker = on)
AS
SELECT
  c.id AS client_id,
  c.tenant_id,
  c.sm_client_id,
  c.name AS client_name,
  c.email,
  c.email_normalized,
  c.phone,
  c.phone_formatted,
  c.phone_normalized,
  c.document,
  c.document_formatted,
  c.city AS client_city,
  c.state AS client_state,
  c.zip_code,
  c.zip_code_formatted,
  c.company,
  c.lead_id AS client_lead_id,
  -- Lead info (cross-linked)
  l.lead_code,
  l.nome AS lead_nome,
  l.status_id AS lead_status_id,
  l.consultor_id AS lead_consultor_id,
  -- Project info
  p.id AS project_id,
  p.sm_project_id,
  p.name AS project_name,
  p.potencia_kwp AS project_potencia_kwp,
  p.valor AS project_valor,
  p.status AS project_status,
  p.city AS project_city,
  p.state AS project_state,
  p.energy_consumption,
  p.phase_type,
  p.voltage,
  p.installation_type,
  p.sm_funnel_name,
  p.sm_stage_name,
  -- Consultant from "Vendedores" funnel stage
  CASE
    WHEN p.sm_funnel_name = 'Vendedores' THEN p.sm_stage_name
    ELSE NULL
  END AS consultor_sm,
  -- Proposal info
  pr.id AS proposal_id,
  pr.sm_proposal_id,
  pr.titulo AS proposal_titulo,
  pr.potencia_kwp AS proposal_potencia_kwp,
  pr.valor_total AS proposal_valor_total,
  pr.status AS proposal_status,
  pr.modulos,
  pr.inversores,
  pr.panel_model,
  pr.panel_quantity,
  pr.inverter_model,
  pr.inverter_quantity,
  pr.economia_mensal,
  pr.payback,
  pr.consumo_mensal,
  pr.link_pdf,
  pr.sm_created_at AS proposal_created_at,
  pr.acceptance_date,
  pr.rejection_date,
  -- Lifecycle classification
  CASE
    WHEN pr.acceptance_date IS NOT NULL THEN 'proposta_aceita'
    WHEN pr.rejection_date IS NOT NULL THEN 'proposta_rejeitada'
    WHEN pr.id IS NOT NULL THEN 'proposta_pendente'
    WHEN p.id IS NOT NULL THEN 'sem_proposta'
    ELSE 'cliente_sem_projeto'
  END AS lifecycle_stage,
  -- Flags
  (p.id IS NOT NULL) AS has_project,
  (pr.id IS NOT NULL) AS has_proposal,
  (c.lead_id IS NOT NULL) AS has_lead_link,
  c.sm_created_at AS client_created_at
FROM public.solar_market_clients c
LEFT JOIN public.solar_market_projects p
  ON p.sm_client_id = c.sm_client_id AND p.tenant_id = c.tenant_id
LEFT JOIN public.solar_market_proposals pr
  ON pr.sm_project_id = p.sm_project_id AND pr.tenant_id = c.tenant_id
LEFT JOIN public.leads l
  ON l.id = c.lead_id;

-- 6) Create function to auto-match SM clients → leads by phone_normalized
CREATE OR REPLACE FUNCTION public.sm_match_clients_to_leads(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count integer := 0;
BEGIN
  UPDATE solar_market_clients smc
  SET lead_id = l.id
  FROM leads l
  WHERE smc.tenant_id = p_tenant_id
    AND l.tenant_id = p_tenant_id
    AND smc.phone_normalized IS NOT NULL
    AND smc.phone_normalized != ''
    AND l.telefone_normalized IS NOT NULL
    AND l.telefone_normalized != ''
    AND smc.phone_normalized = l.telefone_normalized
    AND smc.lead_id IS NULL
    AND l.deleted_at IS NULL;
  
  GET DIAGNOSTICS matched_count = ROW_COUNT;
  RETURN matched_count;
END;
$$;

-- 7) Unschedule the old cron job (if exists) so we can recreate it after
SELECT cron.unschedule('solarmarket-auto-sync');
