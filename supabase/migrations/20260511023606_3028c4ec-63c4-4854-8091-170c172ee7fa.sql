
-- Central Preventiva — Phase 1 (READ-ONLY) — RB-76
-- Reaproveita: vw_proposal_followup_inbox, projetos, recebimentos,
--              proposal_followup_attempts, wa_followup_rules,
--              pipeline_automations, wa_cadences.

CREATE OR REPLACE VIEW public.vw_preventive_dashboard
WITH (security_invoker = true) AS
WITH inbox AS (
  SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE classe_followup = 'sem_resposta')              AS clientes_em_risco,
    COUNT(*) FILTER (WHERE classe_followup IN ('visualizada_sem_retorno','esquecida'))
                                                                          AS propostas_esfriando,
    COUNT(*) FILTER (WHERE COALESCE(ultima_atividade_em, enviada_at)
                            < now() - interval '14 days')                 AS clientes_sem_interacao,
    COALESCE(SUM(valor_total) FILTER (WHERE classe_followup IN
      ('sem_resposta','visualizada_sem_retorno','esquecida')), 0)::numeric AS recuperacao_potencial
  FROM public.vw_proposal_followup_inbox
  GROUP BY tenant_id
),
engenharia AS (
  SELECT
    p.tenant_id,
    COUNT(*) FILTER (
      WHERE p.updated_at < now() - interval '7 days'
        AND COALESCE(LOWER(p.status::text), '') NOT IN ('concluido','cancelado','instalado','perdido')
    ) AS engenharia_parada
  FROM public.projetos p
  GROUP BY p.tenant_id
),
financeiro AS (
  SELECT
    r.tenant_id,
    COUNT(*) FILTER (
      WHERE r.data_vencimento BETWEEN current_date AND current_date + interval '3 days'
        AND COALESCE(LOWER(r.status::text), '') IN ('pendente','aguardando','em_aberto','open')
    ) AS cobrancas_preventivas
  FROM public.recebimentos r
  GROUP BY r.tenant_id
),
attempts AS (
  SELECT
    a.tenant_id,
    COUNT(*) FILTER (WHERE a.created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo'))
                                                                          AS acoes_automaticas_hoje,
    COUNT(*) FILTER (WHERE a.delivery_status = 'queued' AND a.approved_by IS NULL)
                                                                          AS aguardando_revisao
  FROM public.proposal_followup_attempts a
  GROUP BY a.tenant_id
)
SELECT
  COALESCE(i.tenant_id, e.tenant_id, f.tenant_id, a.tenant_id) AS tenant_id,
  COALESCE(i.clientes_em_risco, 0)::int        AS clientes_em_risco,
  COALESCE(i.propostas_esfriando, 0)::int      AS propostas_esfriando,
  COALESCE(e.engenharia_parada, 0)::int        AS engenharia_parada,
  COALESCE(f.cobrancas_preventivas, 0)::int    AS cobrancas_preventivas,
  COALESCE(i.clientes_sem_interacao, 0)::int   AS clientes_sem_interacao,
  COALESCE(a.acoes_automaticas_hoje, 0)::int   AS acoes_automaticas_hoje,
  COALESCE(a.aguardando_revisao, 0)::int       AS aguardando_revisao,
  COALESCE(i.recuperacao_potencial, 0)::numeric AS recuperacao_potencial
FROM inbox i
FULL OUTER JOIN engenharia  e ON e.tenant_id = i.tenant_id
FULL OUTER JOIN financeiro  f ON f.tenant_id = COALESCE(i.tenant_id, e.tenant_id)
FULL OUTER JOIN attempts    a ON a.tenant_id = COALESCE(i.tenant_id, e.tenant_id, f.tenant_id);

CREATE OR REPLACE VIEW public.vw_preventive_heatmap
WITH (security_invoker = true) AS
WITH comercial AS (
  SELECT
    tenant_id,
    COUNT(*)                                                    AS total,
    COUNT(*) FILTER (WHERE classe_followup IN
      ('sem_resposta','visualizada_sem_retorno','esquecida'))    AS criticos
  FROM public.vw_proposal_followup_inbox
  GROUP BY tenant_id
),
posvenda AS (
  SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE data_instalacao IS NOT NULL
      AND data_instalacao >= current_date - interval '60 days')             AS total,
    COUNT(*) FILTER (
      WHERE data_instalacao IS NOT NULL
        AND data_instalacao < current_date - interval '7 days'
        AND data_instalacao >= current_date - interval '60 days'
    )                                                                       AS criticos
  FROM public.projetos
  GROUP BY tenant_id
),
eng AS (
  SELECT
    tenant_id,
    COUNT(*) FILTER (WHERE COALESCE(LOWER(status::text),'') NOT IN
      ('concluido','cancelado','instalado','perdido'))                       AS total,
    COUNT(*) FILTER (
      WHERE updated_at < now() - interval '7 days'
        AND COALESCE(LOWER(status::text),'') NOT IN
          ('concluido','cancelado','instalado','perdido')
    )                                                                        AS criticos
  FROM public.projetos
  GROUP BY tenant_id
),
fin AS (
  SELECT
    tenant_id,
    COUNT(*) FILTER (
      WHERE COALESCE(LOWER(status::text),'') IN
        ('pendente','aguardando','em_aberto','open','vencido')
    )                                                                        AS total,
    COUNT(*) FILTER (
      WHERE data_vencimento < current_date
        AND COALESCE(LOWER(status::text),'') NOT IN
          ('pago','quitado','cancelado','baixado','paid')
    )                                                                        AS criticos
  FROM public.recebimentos
  GROUP BY tenant_id
),
unioned AS (
  SELECT tenant_id, 'comercial'::text AS dominio, 'Comercial'::text AS dominio_label, total, criticos FROM comercial
  UNION ALL
  SELECT tenant_id, 'pos_venda', 'Pós-Venda', total, criticos FROM posvenda
  UNION ALL
  SELECT tenant_id, 'engenharia', 'Engenharia', total, criticos FROM eng
  UNION ALL
  SELECT tenant_id, 'financeiro', 'Financeiro', total, criticos FROM fin
)
SELECT
  tenant_id,
  dominio,
  dominio_label,
  COALESCE(total, 0)::int     AS total,
  COALESCE(criticos, 0)::int  AS criticos,
  CASE
    WHEN COALESCE(total,0) = 0 THEN 0
    ELSE ROUND((criticos::numeric / total::numeric) * 100, 1)
  END                         AS criticos_pct,
  CASE
    WHEN COALESCE(total,0) = 0 THEN 'saudavel'
    WHEN (criticos::numeric / NULLIF(total,0)::numeric) >= 0.30 THEN 'critico'
    WHEN (criticos::numeric / NULLIF(total,0)::numeric) >= 0.10 THEN 'atencao'
    ELSE 'saudavel'
  END                         AS status
FROM unioned
WHERE tenant_id IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_preventive_scenarios
WITH (security_invoker = true) AS
WITH wa_rules AS (
  SELECT
    r.id                                                AS scenario_id,
    r.tenant_id,
    r.nome,
    COALESCE(r.descricao, r.cenario)                    AS descricao,
    'comercial'::text                                   AS dominio,
    r.ativo                                             AS ativo,
    COALESCE(r.usar_ia, false)                          AS usa_ia,
    COALESCE(r.cooldown_horas, 24)                      AS cooldown_horas,
    COALESCE(r.precisa_revisao_humana, false)           AS requer_aprovacao,
    'wa_followup_rules'::text                           AS executor,
    r.cenario                                           AS gatilho
  FROM public.wa_followup_rules r
),
pipe_auto AS (
  SELECT
    pa.id                                               AS scenario_id,
    pa.tenant_id,
    pa.nome,
    COALESCE(pa.mensagem_notificacao, pa.tipo_acao)     AS descricao,
    'comercial'::text                                   AS dominio,
    pa.ativo,
    false                                               AS usa_ia,
    COALESCE(pa.tempo_horas, 24)                        AS cooldown_horas,
    false                                               AS requer_aprovacao,
    'pipeline_automations'::text                        AS executor,
    pa.tipo_gatilho                                     AS gatilho
  FROM public.pipeline_automations pa
),
cadences AS (
  SELECT
    c.id                                                AS scenario_id,
    c.tenant_id,
    c.nome,
    COALESCE(c.descricao, c.tipo)                       AS descricao,
    CASE
      WHEN c.tipo ILIKE '%pos%' OR c.tipo ILIKE '%pós%' THEN 'pos_venda'
      WHEN c.tipo ILIKE '%cob%' OR c.tipo ILIKE '%dun%' THEN 'financeiro'
      WHEN c.tipo ILIKE '%eng%'                          THEN 'engenharia'
      ELSE 'comercial'
    END                                                 AS dominio,
    c.ativo,
    false                                               AS usa_ia,
    24                                                  AS cooldown_horas,
    false                                               AS requer_aprovacao,
    'wa_cadences'::text                                 AS executor,
    COALESCE(c.tipo, 'cadencia')                        AS gatilho
  FROM public.wa_cadences c
),
scenarios AS (
  SELECT * FROM wa_rules
  UNION ALL
  SELECT * FROM pipe_auto
  UNION ALL
  SELECT * FROM cadences
)
SELECT
  s.scenario_id,
  s.tenant_id,
  s.nome,
  s.descricao,
  s.dominio,
  s.ativo,
  s.usa_ia,
  s.cooldown_horas::int                                 AS cooldown_horas,
  s.requer_aprovacao,
  s.executor,
  s.gatilho,
  COALESCE(stats.volume_estimado, 0)::int               AS volume_estimado
FROM scenarios s
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS volume_estimado
  FROM public.proposal_followup_attempts a
  WHERE a.tenant_id = s.tenant_id
    AND a.created_at >= now() - interval '30 days'
) stats ON true;

GRANT SELECT ON public.vw_preventive_dashboard TO authenticated;
GRANT SELECT ON public.vw_preventive_heatmap   TO authenticated;
GRANT SELECT ON public.vw_preventive_scenarios TO authenticated;
