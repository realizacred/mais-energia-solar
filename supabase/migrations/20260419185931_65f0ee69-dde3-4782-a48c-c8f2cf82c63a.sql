
-- Piloto controlado da migração SolarMarket: marca exatamente 15 propostas representativas
-- Tenant alvo: 17de8315-2e2f-4a79-8751-e5d507d69a41
-- Estratégia: limpar marcações antigas no tenant e selecionar 1 caso por cenário crítico,
-- preferindo registros com sm_project_id NOT NULL (necessário para resolução de projeto/cliente).

-- 1) Reset: garante que apenas as escolhidas neste lote estarão marcadas
UPDATE solar_market_proposals
   SET migrar_para_canonico = false,
       migrar_requested_at = NULL,
       migrar_requested_by = NULL
 WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
   AND migrar_para_canonico = true
   AND migrado_em IS NULL;

-- 2) Seleção representativa (15 propostas)
WITH proj AS (
  SELECT sm_project_id, sm_funnel_name, sm_stage_name
    FROM solar_market_projects
   WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
),
base AS (
  SELECT p.id, p.sm_proposal_id, p.sm_project_id, p.sm_client_id, p.status,
         p.titulo, p.valor_total, p.panel_quantity, p.payment_conditions,
         pj.sm_funnel_name, pj.sm_stage_name,
         (CASE
            WHEN p.valor_total IS NOT NULL AND p.panel_quantity IS NOT NULL
                 AND COALESCE(p.payment_conditions,'') <> '' THEN 1
            ELSE 0
          END) AS completude_score
    FROM solar_market_proposals p
    LEFT JOIN proj pj ON pj.sm_project_id = p.sm_project_id
   WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
     AND p.migrado_em IS NULL
     AND p.sm_project_id IS NOT NULL
),
-- 1 caso por cenário (cobre status × funnel)
sel AS (
  -- A) sm_funnel_name NULL × status created
  (SELECT id, 'A_funnel_null_created' AS cenario FROM base WHERE sm_funnel_name IS NULL AND status='created' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- B) sm_funnel_name NULL × status generated
  (SELECT id, 'B_funnel_null_generated' FROM base WHERE sm_funnel_name IS NULL AND status='generated' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- C) sm_funnel_name NULL × status viewed
  (SELECT id, 'C_funnel_null_viewed' FROM base WHERE sm_funnel_name IS NULL AND status='viewed' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- D) sm_funnel_name NULL × status approved
  (SELECT id, 'D_funnel_null_approved' FROM base WHERE sm_funnel_name IS NULL AND status='approved' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- E) Vendedores × created
  (SELECT id, 'E_vendedores_created' FROM base WHERE sm_funnel_name='Vendedores' AND status='created' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- F) Vendedores × generated
  (SELECT id, 'F_vendedores_generated' FROM base WHERE sm_funnel_name='Vendedores' AND status='generated' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- G) Vendedores × sent
  (SELECT id, 'G_vendedores_sent' FROM base WHERE sm_funnel_name='Vendedores' AND status='sent' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- H) Vendedores × viewed
  (SELECT id, 'H_vendedores_viewed' FROM base WHERE sm_funnel_name='Vendedores' AND status='viewed' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- I) Vendedores × approved
  (SELECT id, 'I_vendedores_approved' FROM base WHERE sm_funnel_name='Vendedores' AND status='approved' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- J) Engenharia × generated
  (SELECT id, 'J_engenharia_generated' FROM base WHERE sm_funnel_name='Engenharia' AND status='generated' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- K) Engenharia × approved
  (SELECT id, 'K_engenharia_approved' FROM base WHERE sm_funnel_name='Engenharia' AND status='approved' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- L) LEAD × generated  (mapeia para Comercial canônico)
  (SELECT id, 'L_lead_generated' FROM base WHERE sm_funnel_name='LEAD' AND status='generated' ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- M) Status NULL × Vendedores  (status nulo → fallback)
  (SELECT id, 'M_vendedores_status_null' FROM base WHERE sm_funnel_name='Vendedores' AND status IS NULL ORDER BY completude_score DESC, sm_proposal_id LIMIT 1)
  UNION ALL
  -- N) Caso ALTAMENTE COMPLETO (qualquer funnel/status, dados ricos)
  (SELECT id, 'N_completo_top' FROM base WHERE completude_score=1 AND status='approved' ORDER BY valor_total DESC NULLS LAST LIMIT 1)
  UNION ALL
  -- O) Caso INCOMPLETO MAS MIGRÁVEL (sem valor, sem qtd painéis, sem condições — só staging mínimo)
  (SELECT id, 'O_incompleto_migravel' FROM base
    WHERE valor_total IS NULL AND panel_quantity IS NULL
      AND COALESCE(payment_conditions,'') = ''
    ORDER BY sm_proposal_id LIMIT 1)
)
UPDATE solar_market_proposals p
   SET migrar_para_canonico = true,
       migrar_requested_at = now()
  FROM sel
 WHERE p.id = sel.id
   AND p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
