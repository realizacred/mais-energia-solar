-- RPC: detect_proposal_followup_candidates
-- Detecta candidatos a follow-up por proposta (somente leitura).
-- Reutiliza wa_followup_rules (ativo + cenario) + propostas_nativas + proposta_versoes.
-- NÃO envia, NÃO chama IA. Apenas retorna candidatos prontos para enfileirar.

CREATE OR REPLACE FUNCTION public.detect_proposal_followup_candidates(p_tenant_id uuid)
RETURNS TABLE (
  proposta_id uuid,
  versao_id uuid,
  cenario text,
  scheduled_at timestamptz,
  assigned_to uuid,
  proposal_context jsonb,
  rule_id uuid,
  conversation_id uuid,
  tenant_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_rules AS (
    SELECT r.id AS rule_id, r.cenario, r.prazo_minutos, r.tenant_id
    FROM wa_followup_rules r
    WHERE r.tenant_id = p_tenant_id
      AND r.ativo = true
      AND r.cenario LIKE 'proposta_%'
  ),
  base AS (
    SELECT
      pn.id              AS proposta_id,
      pv.id              AS versao_id,
      pn.tenant_id       AS tenant_id,
      pn.cliente_id,
      pn.lead_id,
      pn.consultor_id,
      pn.status          AS status_proposta,
      pv.enviado_em,
      pv.viewed_at,
      pv.valido_ate,
      pv.valor_total,
      pv.potencia_kwp,
      pv.economia_mensal,
      c.nome             AS cliente_nome
    FROM propostas_nativas pn
    JOIN proposta_versoes pv
      ON pv.proposta_id = pn.id
     AND pv.versao_numero = pn.versao_atual
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    WHERE pn.tenant_id = p_tenant_id
      AND pn.deleted_at IS NULL
  ),
  -- Conversa WA do cliente/lead (mais recente, mesmo tenant)
  conv AS (
    SELECT DISTINCT ON (b.proposta_id)
      b.proposta_id,
      wc.id  AS conversation_id,
      wc.assigned_to AS conv_assigned_to
    FROM base b
    JOIN wa_conversations wc
      ON wc.tenant_id = b.tenant_id
     AND (
          (b.cliente_id IS NOT NULL AND wc.cliente_id = b.cliente_id)
       OR (b.lead_id    IS NOT NULL AND wc.lead_id    = b.lead_id)
     )
    ORDER BY b.proposta_id, wc.last_message_at DESC NULLS LAST
  ),
  candidates AS (
    -- C1: proposta enviada sem visualização
    SELECT
      b.*, ar.rule_id, ar.cenario, ar.prazo_minutos,
      b.enviado_em + (ar.prazo_minutos || ' minutes')::interval AS scheduled_at,
      EXTRACT(EPOCH FROM (now() - b.enviado_em))/86400.0 AS dias_sem_resposta
    FROM base b
    JOIN active_rules ar ON ar.cenario = 'proposta_enviada_sem_visualizacao'
    WHERE b.enviado_em IS NOT NULL
      AND b.viewed_at IS NULL
      AND b.status_proposta NOT IN ('aceita','recusada','cancelada')
      AND (b.valido_ate IS NULL OR b.valido_ate >= current_date)
      AND now() - b.enviado_em >= (ar.prazo_minutos || ' minutes')::interval

    UNION ALL
    -- C2: proposta visualizada sem decisão
    SELECT
      b.*, ar.rule_id, ar.cenario, ar.prazo_minutos,
      b.viewed_at + (ar.prazo_minutos || ' minutes')::interval,
      EXTRACT(EPOCH FROM (now() - b.viewed_at))/86400.0
    FROM base b
    JOIN active_rules ar ON ar.cenario = 'proposta_visualizada_sem_decisao'
    WHERE b.viewed_at IS NOT NULL
      AND b.status_proposta NOT IN ('aceita','recusada','cancelada')
      AND (b.valido_ate IS NULL OR b.valido_ate >= current_date)
      AND now() - b.viewed_at >= (ar.prazo_minutos || ' minutes')::interval

    UNION ALL
    -- C3: proposta prestes a expirar
    SELECT
      b.*, ar.rule_id, ar.cenario, ar.prazo_minutos,
      now(),
      EXTRACT(EPOCH FROM (now() - COALESCE(b.viewed_at, b.enviado_em, now())))/86400.0
    FROM base b
    JOIN active_rules ar ON ar.cenario = 'proposta_prestes_a_expirar'
    WHERE b.valido_ate IS NOT NULL
      AND b.status_proposta NOT IN ('aceita','recusada','cancelada')
      AND b.valido_ate >= current_date
      AND (b.valido_ate::timestamptz - now()) <= (ar.prazo_minutos || ' minutes')::interval

    UNION ALL
    -- C4: proposta aceita sem avanço (alerta interno)
    SELECT
      b.*, ar.rule_id, ar.cenario, ar.prazo_minutos,
      now(),
      NULL::numeric
    FROM base b
    JOIN active_rules ar ON ar.cenario = 'proposta_aceita_sem_avanco'
    WHERE b.status_proposta = 'aceita'
  )
  SELECT
    cand.proposta_id,
    cand.versao_id,
    cand.cenario,
    cand.scheduled_at,
    COALESCE(conv.conv_assigned_to, cand.consultor_id) AS assigned_to,
    jsonb_build_object(
      'cliente_nome',     cand.cliente_nome,
      'valor_total',      cand.valor_total,
      'potencia_kwp',     cand.potencia_kwp,
      'economia_mensal',  cand.economia_mensal,
      'status_proposta',  cand.status_proposta,
      'enviado_em',       cand.enviado_em,
      'viewed_at',        cand.viewed_at,
      'valido_ate',       cand.valido_ate,
      'dias_sem_resposta',cand.dias_sem_resposta,
      'cenario',          cand.cenario
    ) AS proposal_context,
    cand.rule_id,
    conv.conversation_id,
    cand.tenant_id
  FROM candidates cand
  JOIN conv ON conv.proposta_id = cand.proposta_id
  WHERE conv.conversation_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_proposal_followup_candidates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_proposal_followup_candidates(uuid) TO service_role;