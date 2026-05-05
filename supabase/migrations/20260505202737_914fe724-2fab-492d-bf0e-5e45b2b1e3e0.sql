
-- =============================================================================
-- INBOX WHATSAPP — CORREÇÃO DEFINITIVA (1 cliente = 1 conversa) — v2
-- =============================================================================

CREATE TABLE IF NOT EXISTS wa_merge_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  telefone_normalized text,
  is_group boolean,
  canonical_id uuid NOT NULL,
  duplicate_id uuid NOT NULL,
  msgs_moved int NOT NULL DEFAULT 0,
  duplicate_instance_id uuid,
  canonical_instance_id uuid,
  duplicate_lead_id uuid,
  duplicate_cliente_id uuid,
  duplicate_status text,
  notes text
);
ALTER TABLE wa_merge_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin reads merge log" ON wa_merge_audit_log;
CREATE POLICY "super admin reads merge log"
  ON wa_merge_audit_log FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE TABLE IF NOT EXISTS wa_conversations_backup_premerge AS
SELECT c.*, now() AS backed_up_at FROM wa_conversations c WHERE FALSE;
ALTER TABLE wa_conversations_backup_premerge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admin reads conv backup" ON wa_conversations_backup_premerge;
CREATE POLICY "super admin reads conv backup"
  ON wa_conversations_backup_premerge FOR SELECT TO authenticated
  USING (is_super_admin());

DROP TABLE IF EXISTS _tmp_canonical_map;
CREATE TEMP TABLE _tmp_canonical_map AS
WITH grupos AS (
  SELECT c.id, c.tenant_id, c.telefone_normalized, c.is_group, c.instance_id,
         c.created_at, c.last_message_at, c.lead_id, c.cliente_id, c.status,
         COALESCE((SELECT COUNT(*) FROM wa_messages m WHERE m.conversation_id = c.id), 0) AS msg_count
  FROM wa_conversations c
  WHERE c.telefone_normalized IS NOT NULL AND c.telefone_normalized <> ''
    AND EXISTS (
      SELECT 1 FROM wa_conversations c2
      WHERE c2.tenant_id=c.tenant_id AND c2.telefone_normalized=c.telefone_normalized
        AND c2.is_group=c.is_group AND c2.id<>c.id
    )
),
ranked AS (
  SELECT g.*, ROW_NUMBER() OVER (
    PARTITION BY tenant_id, telefone_normalized, is_group
    ORDER BY msg_count DESC, created_at ASC, id ASC
  ) AS rn FROM grupos g
),
canonicals AS (
  SELECT tenant_id, telefone_normalized, is_group, id AS canonical_id, instance_id AS canonical_instance_id
  FROM ranked WHERE rn = 1
)
SELECT g.id AS duplicate_id, g.tenant_id, g.telefone_normalized, g.is_group,
       g.instance_id AS duplicate_instance_id, g.lead_id AS duplicate_lead_id,
       g.cliente_id AS duplicate_cliente_id, g.status AS duplicate_status,
       g.msg_count AS duplicate_msg_count,
       c.canonical_id, c.canonical_instance_id
FROM grupos g
JOIN canonicals c USING (tenant_id, telefone_normalized, is_group)
WHERE g.id <> c.canonical_id;

INSERT INTO wa_conversations_backup_premerge
SELECT c.*, now() FROM wa_conversations c
WHERE c.id IN (SELECT duplicate_id FROM _tmp_canonical_map);

-- Reapontar tabelas (UPDATE direto)
UPDATE wa_messages m SET conversation_id=m2.canonical_id FROM _tmp_canonical_map m2 WHERE m.conversation_id=m2.duplicate_id;
UPDATE wa_followup_logs t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_outbox t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_ai_tasks t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_auto_reply_log t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_cadence_enrollments t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_conversation_resolution_events t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_conversation_resolution_logs t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_internal_threads t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_participant_events t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_satisfaction_ratings t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_sla_alerts t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE wa_transfers t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;
UPDATE appointments t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

-- Tabelas com UNIQUE: mover sem conflitar, depois deletar restante
UPDATE wa_conversation_tags t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM wa_conversation_tags x WHERE x.conversation_id=m.canonical_id AND x.tag_id=t.tag_id);
DELETE FROM wa_conversation_tags t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_reads t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM wa_reads x WHERE x.conversation_id=m.canonical_id AND x.user_id=t.user_id);
DELETE FROM wa_reads t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_conversation_participants t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM wa_conversation_participants x WHERE x.conversation_id=m.canonical_id AND x.user_id=t.user_id);
DELETE FROM wa_conversation_participants t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_conversation_preferences t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM wa_conversation_preferences x WHERE x.conversation_id=m.canonical_id AND x.user_id=t.user_id);
DELETE FROM wa_conversation_preferences t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE push_muted_conversations t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM push_muted_conversations x WHERE x.conversation_id=m.canonical_id AND x.user_id=t.user_id);
DELETE FROM push_muted_conversations t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_conversation_summaries t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT EXISTS (SELECT 1 FROM wa_conversation_summaries x WHERE x.conversation_id=m.canonical_id);
DELETE FROM wa_conversation_summaries t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_conversation_resolution_suggestions t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT (t.status='pending' AND EXISTS (
     SELECT 1 FROM wa_conversation_resolution_suggestions x
     WHERE x.conversation_id=m.canonical_id AND x.status='pending'));
DELETE FROM wa_conversation_resolution_suggestions t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

UPDATE wa_followup_queue t SET conversation_id=m.canonical_id FROM _tmp_canonical_map m
 WHERE t.conversation_id=m.duplicate_id
   AND NOT (t.status IN ('pendente','pendente_revisao','enviado') AND EXISTS (
     SELECT 1 FROM wa_followup_queue x
     WHERE x.conversation_id=m.canonical_id AND x.rule_id=t.rule_id AND x.tentativa=t.tentativa
       AND x.status IN ('pendente','pendente_revisao','enviado')));
DELETE FROM wa_followup_queue t USING _tmp_canonical_map m WHERE t.conversation_id=m.duplicate_id;

-- Merge lead_id, cliente_id, status na canônica
WITH best AS (
  SELECT m.canonical_id,
         (ARRAY_AGG(m.duplicate_lead_id) FILTER (WHERE m.duplicate_lead_id IS NOT NULL))[1] AS dup_lead,
         (ARRAY_AGG(m.duplicate_cliente_id) FILTER (WHERE m.duplicate_cliente_id IS NOT NULL))[1] AS dup_cliente,
         BOOL_OR(m.duplicate_status='open') AS any_open
  FROM _tmp_canonical_map m GROUP BY m.canonical_id
)
UPDATE wa_conversations c
   SET lead_id=COALESCE(c.lead_id, b.dup_lead),
       cliente_id=COALESCE(c.cliente_id, b.dup_cliente),
       status=CASE WHEN b.any_open AND c.status IN ('resolved','closed') THEN 'open' ELSE c.status END
  FROM best b WHERE c.id=b.canonical_id;

INSERT INTO wa_merge_audit_log (
  tenant_id, telefone_normalized, is_group, canonical_id, duplicate_id,
  msgs_moved, duplicate_instance_id, canonical_instance_id,
  duplicate_lead_id, duplicate_cliente_id, duplicate_status, notes)
SELECT m.tenant_id, m.telefone_normalized, m.is_group, m.canonical_id, m.duplicate_id,
       m.duplicate_msg_count, m.duplicate_instance_id, m.canonical_instance_id,
       m.duplicate_lead_id, m.duplicate_cliente_id, m.duplicate_status,
       'phase1_canonicalization'
FROM _tmp_canonical_map m;

DELETE FROM wa_conversations c WHERE c.id IN (SELECT duplicate_id FROM _tmp_canonical_map);

-- Recalcular last_message_* e unread_count nas canônicas
WITH stats AS (
  SELECT m.conversation_id, MAX(m.created_at) AS max_created,
         COUNT(*) FILTER (WHERE m.direction='in' AND m.read_at IS NULL) AS unread
  FROM wa_messages m
  WHERE m.conversation_id IN (SELECT DISTINCT canonical_id FROM _tmp_canonical_map)
  GROUP BY m.conversation_id
), last_msg AS (
  SELECT DISTINCT ON (m.conversation_id)
         m.conversation_id, m.id AS last_id, m.direction, m.created_at,
         LEFT(COALESCE(m.content,''), 100) AS preview
  FROM wa_messages m
  WHERE m.conversation_id IN (SELECT DISTINCT canonical_id FROM _tmp_canonical_map)
  ORDER BY m.conversation_id, m.created_at DESC
)
UPDATE wa_conversations c
   SET last_message_at=s.max_created, last_message_id=lm.last_id,
       last_message_direction=lm.direction, last_message_preview=lm.preview,
       unread_count=COALESCE(s.unread, 0)
  FROM stats s LEFT JOIN last_msg lm ON lm.conversation_id=s.conversation_id
 WHERE c.id=s.conversation_id;

-- FASE 4 — Conversas fantasmas
UPDATE wa_conversations c
   SET last_message_at=NULL, last_message_id=NULL, last_message_preview=NULL,
       last_message_direction=NULL, unread_count=0
 WHERE c.last_message_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM wa_messages m WHERE m.conversation_id=c.id);

-- FASE 6 — Trocar UNIQUE: dropar constraint+índices antigos, criar novos
ALTER TABLE public.wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_instance_id_remote_jid_key;
DROP INDEX IF EXISTS public.wa_conversations_instance_id_remote_jid_key;
DROP INDEX IF EXISTS public.idx_wa_conv_instance_remote_uniq;
DROP INDEX IF EXISTS public.idx_wa_conv_unique_instance_phone;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_conv_tenant_phone
  ON public.wa_conversations (tenant_id, telefone_normalized, is_group)
  WHERE telefone_normalized IS NOT NULL AND telefone_normalized <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_conv_tenant_group_jid
  ON public.wa_conversations (tenant_id, remote_jid)
  WHERE is_group = true;
