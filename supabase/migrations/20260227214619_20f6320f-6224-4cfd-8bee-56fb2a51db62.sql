
-- Fix: recreate view with security_invoker to use caller's RLS
DROP VIEW IF EXISTS public.sm_analytics_view;

CREATE OR REPLACE VIEW public.sm_analytics_view
WITH (security_invoker = on) AS
SELECT
  p.tenant_id,
  p.sm_project_id,
  p.name AS project_name,
  p.status AS project_status,
  p.potencia_kwp AS project_potencia_kwp,
  p.valor AS project_valor,
  p.city AS project_city,
  p.state AS project_state,
  p.installation_type,
  p.energy_consumption,
  p.sm_created_at AS project_created_at,
  c.sm_client_id,
  c.name AS client_name,
  c.email AS client_email,
  c.phone AS client_phone,
  c.document AS client_document,
  c.city AS client_city,
  c.state AS client_state,
  c.company AS client_company,
  p.sm_funnel_name AS funnel_name,
  p.sm_stage_name AS funnel_stage,
  CASE WHEN p.sm_funnel_name = 'Vendedores' THEN p.sm_stage_name ELSE NULL END AS consultor_sm,
  p.responsible->>'name' AS responsible_name,
  prop.sm_proposal_id,
  prop.titulo AS proposal_title,
  prop.potencia_kwp AS proposal_potencia_kwp,
  prop.valor_total AS proposal_valor_total,
  prop.preco_total AS proposal_preco_total,
  prop.status AS proposal_status,
  prop.panel_model,
  prop.panel_quantity,
  prop.inverter_model,
  prop.inverter_quantity,
  prop.economia_mensal,
  prop.economia_mensal_percent,
  prop.payback,
  prop.geracao_anual,
  prop.link_pdf,
  prop.sm_created_at AS proposal_created_at,
  prop.acceptance_date,
  prop.rejection_date,
  CASE WHEN prop.sm_proposal_id IS NOT NULL THEN true ELSE false END AS has_proposal,
  CASE WHEN prop.acceptance_date IS NOT NULL THEN true ELSE false END AS is_client,
  CASE 
    WHEN prop.acceptance_date IS NOT NULL THEN 'cliente_ativo'
    WHEN prop.sm_proposal_id IS NOT NULL AND prop.rejection_date IS NULL THEN 'proposta_pendente'
    WHEN prop.rejection_date IS NOT NULL THEN 'proposta_rejeitada'
    WHEN c.sm_client_id IS NOT NULL AND prop.sm_proposal_id IS NULL THEN 'sem_proposta'
    ELSE 'sem_dados'
  END AS lifecycle_stage,
  (SELECT COUNT(*) FROM solar_market_proposals pp 
   WHERE pp.sm_project_id = p.sm_project_id AND pp.tenant_id = p.tenant_id) AS total_proposals
FROM solar_market_projects p
LEFT JOIN solar_market_clients c 
  ON c.sm_client_id = p.sm_client_id AND c.tenant_id = p.tenant_id
LEFT JOIN LATERAL (
  SELECT * FROM solar_market_proposals pr
  WHERE pr.sm_project_id = p.sm_project_id AND pr.tenant_id = p.tenant_id
  ORDER BY 
    CASE WHEN pr.acceptance_date IS NOT NULL THEN 0 ELSE 1 END,
    pr.sm_created_at DESC
  LIMIT 1
) prop ON true;

COMMENT ON VIEW public.sm_analytics_view IS 
  'View analítica SolarMarket: cruza clientes, projetos, propostas e funis. consultor_sm vem da etapa do funil Vendedores. lifecycle_stage: cliente_ativo, proposta_pendente, proposta_rejeitada, sem_proposta, sem_dados.';
