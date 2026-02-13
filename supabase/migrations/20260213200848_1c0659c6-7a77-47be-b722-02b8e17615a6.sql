
-- ============================================================
-- FASE 2a: claim_followup_candidates RPC + índice de suporte
-- ============================================================

-- Índice composto para dedup/attempt_count (cobre EXISTS + COUNT)
CREATE INDEX IF NOT EXISTS idx_wa_followup_queue_dedup
  ON wa_followup_queue (conversation_id, rule_id, status, sent_at);

-- RPC: retorna candidatos a follow-up em batch, sem N+1
CREATE OR REPLACE FUNCTION public.claim_followup_candidates(_limit integer DEFAULT 200)
RETURNS TABLE (
  conversation_id uuid,
  rule_id uuid,
  tenant_id uuid,
  remote_jid text,
  instance_id uuid,
  cliente_nome text,
  cliente_telefone text,
  assigned_to uuid,
  last_msg_direction text,
  attempt_count bigint,
  max_tentativas integer,
  envio_automatico boolean,
  mensagem_template text,
  cenario text,
  prazo_minutos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH
  -- 1) Active rules (small table, full scan OK)
  active_rules AS (
    SELECT r.id, r.tenant_id, r.cenario, r.prazo_minutos, r.max_tentativas,
           r.envio_automatico, r.mensagem_template, r.status_conversa,
           -- TTL clamp: min 30min, max 48h, default prazo_minutos * 2
           GREATEST(30, LEAST(2880, r.prazo_minutos * 2)) AS ttl_minutes
    FROM wa_followup_rules r
    WHERE r.ativo = true
  ),

  -- 2) Conversation-first: match convs to rules, filter by cutoff
  --    ORDER BY last_message_at ASC = oldest first = fairness
  matched AS (
    SELECT
      c.id AS conversation_id,
      ar.id AS rule_id,
      ar.tenant_id,
      c.remote_jid,
      c.instance_id,
      c.cliente_nome,
      c.cliente_telefone,
      c.assigned_to,
      ar.max_tentativas,
      ar.envio_automatico,
      ar.mensagem_template,
      ar.cenario,
      ar.prazo_minutos,
      ar.ttl_minutes
    FROM wa_conversations c
    JOIN active_rules ar
      ON ar.tenant_id = c.tenant_id
      AND c.status = ANY(COALESCE(ar.status_conversa, ARRAY['open']))
      AND c.last_message_at < (now() - (ar.prazo_minutos || ' minutes')::interval)
    WHERE c.is_group = false
    ORDER BY c.last_message_at ASC
    LIMIT _limit
  ),

  -- 3) Dedup: exclude convs with active follow-up (pendente or recently sent within TTL)
  deduped AS (
    SELECT m.*
    FROM matched m
    WHERE NOT EXISTS (
      SELECT 1 FROM wa_followup_queue fq
      WHERE fq.conversation_id = m.conversation_id
        AND fq.rule_id = m.rule_id
        AND (
          fq.status = 'pendente'
          OR (fq.status = 'enviado'
              AND fq.sent_at > now() - (m.ttl_minutes || ' minutes')::interval)
        )
    )
  ),

  -- 4) Attempt count: only statuses that represent real attempts
  with_attempts AS (
    SELECT
      d.*,
      COALESCE(ac.cnt, 0) AS attempt_count
    FROM deduped d
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS cnt
      FROM wa_followup_queue fq
      WHERE fq.conversation_id = d.conversation_id
        AND fq.rule_id = d.rule_id
        AND fq.status IN ('enviado', 'respondido')
    ) ac ON true
    WHERE COALESCE(ac.cnt, 0) < d.max_tentativas
  ),

  -- 5) Last message direction (eliminates N+1)
  last_directions AS (
    SELECT DISTINCT ON (wm.conversation_id)
      wm.conversation_id,
      wm.direction
    FROM wa_messages wm
    WHERE wm.conversation_id IN (SELECT wa.conversation_id FROM with_attempts wa)
      AND wm.is_internal_note = false
    ORDER BY wm.conversation_id, wm.created_at DESC
  )

SELECT
  wa.conversation_id,
  wa.rule_id,
  wa.tenant_id,
  wa.remote_jid,
  wa.instance_id,
  wa.cliente_nome,
  wa.cliente_telefone,
  wa.assigned_to,
  COALESCE(ld.direction, 'unknown') AS last_msg_direction,
  wa.attempt_count,
  wa.max_tentativas,
  wa.envio_automatico,
  wa.mensagem_template,
  wa.cenario,
  wa.prazo_minutos
FROM with_attempts wa
LEFT JOIN last_directions ld ON ld.conversation_id = wa.conversation_id;
$$;

COMMENT ON FUNCTION public.claim_followup_candidates IS
'Batch-claims follow-up candidates. Fairness: oldest conversations first (last_message_at ASC). '
'TTL dedup: clamped between 30min and 48h (prazo_minutos * 2). '
'Attempt count: only enviado/respondido count. '
'KNOWN LIMITATION: fairness is by conversation age, not round-robin by tenant. '
'With 1000+ tenants and skewed volumes, a single high-volume tenant could consume most of the LIMIT. '
'Mitigation: add per-tenant sub-limit or partition by tenant_id in future phase.';
