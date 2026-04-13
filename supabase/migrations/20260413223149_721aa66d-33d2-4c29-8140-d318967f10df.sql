
-- ============================================================
-- PHASE 0: BACKUP TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public._wa_merge_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merge_run_at timestamptz DEFAULT now(),
  canonical_id uuid NOT NULL,
  absorbed_id uuid NOT NULL,
  absorbed_data jsonb NOT NULL,
  child_counts jsonb DEFAULT '{}'::jsonb
);

-- ============================================================
-- PHASE 1: BUILD MERGE PLAN
-- ============================================================
CREATE TEMP TABLE _merge_plan AS
WITH normalized AS (
  SELECT id, instance_id, remote_jid, cliente_nome, cliente_telefone,
         last_message_at, status, tenant_id, created_at,
         regexp_replace(
           split_part(remote_jid, '@', 1),
           '^55(\d{2})9?(\d{8})$', '55\1\2'
         ) as phone_norm
  FROM wa_conversations
  WHERE remote_jid NOT LIKE '%@g.us'
    AND remote_jid IS NOT NULL
),
ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY instance_id, phone_norm
      ORDER BY
        (SELECT count(*) FROM wa_messages m WHERE m.conversation_id = normalized.id) DESC,
        CASE WHEN cliente_nome IS NOT NULL AND cliente_nome !~ '^\d+$' THEN 0 ELSE 1 END,
        last_message_at DESC NULLS LAST,
        created_at ASC
    ) as rn,
    count(*) OVER (PARTITION BY instance_id, phone_norm) as group_size
  FROM normalized
)
SELECT
  r.instance_id,
  r.phone_norm,
  r.id as conv_id,
  r.rn,
  FIRST_VALUE(r.id) OVER (
    PARTITION BY r.instance_id, r.phone_norm
    ORDER BY r.rn
  ) as canonical_id,
  r.group_size
FROM ranked r
WHERE r.group_size > 1;

-- ============================================================
-- PHASE 2: BACKUP ABSORBED CONVERSATIONS
-- ============================================================
INSERT INTO public._wa_merge_backup (canonical_id, absorbed_id, absorbed_data, child_counts)
SELECT
  mp.canonical_id,
  mp.conv_id,
  to_jsonb(c.*),
  jsonb_build_object(
    'messages', (SELECT count(*) FROM wa_messages WHERE conversation_id = mp.conv_id),
    'tags', (SELECT count(*) FROM wa_conversation_tags WHERE conversation_id = mp.conv_id),
    'participants', (SELECT count(*) FROM wa_conversation_participants WHERE conversation_id = mp.conv_id),
    'reads', (SELECT count(*) FROM wa_reads WHERE conversation_id = mp.conv_id),
    'outbox', (SELECT count(*) FROM wa_outbox WHERE conversation_id = mp.conv_id),
    'sla_alerts', (SELECT count(*) FROM wa_sla_alerts WHERE conversation_id = mp.conv_id),
    'transfers', (SELECT count(*) FROM wa_transfers WHERE conversation_id = mp.conv_id)
  )
FROM _merge_plan mp
JOIN wa_conversations c ON c.id = mp.conv_id
WHERE mp.conv_id != mp.canonical_id;

-- ============================================================
-- PHASE 3: MOVE CHILD RECORDS (absorbed → canonical)
-- All tables with unique constraints get DELETE-before-UPDATE
-- ============================================================

-- 3.1 Messages (no unique constraint on conversation_id combo)
UPDATE wa_messages SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_messages.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.2 Tags (unique: conversation_id, tag_id)
DELETE FROM wa_conversation_tags ct
USING _merge_plan mp
WHERE ct.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM wa_conversation_tags ct2
    WHERE ct2.conversation_id = mp.canonical_id AND ct2.tag_id = ct.tag_id
  );
UPDATE wa_conversation_tags SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_conversation_tags.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.3 Participants (unique: conversation_id, user_id)
DELETE FROM wa_conversation_participants cp
USING _merge_plan mp
WHERE cp.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM wa_conversation_participants cp2
    WHERE cp2.conversation_id = mp.canonical_id AND cp2.user_id = cp.user_id
  );
UPDATE wa_conversation_participants SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_conversation_participants.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.4 Reads (unique: conversation_id, user_id) — DEDUP FIRST
DELETE FROM wa_reads r
USING _merge_plan mp
WHERE r.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM wa_reads r2
    WHERE r2.conversation_id = mp.canonical_id AND r2.user_id = r.user_id
  );
UPDATE wa_reads SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_reads.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.5 Outbox
UPDATE wa_outbox SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_outbox.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.6 SLA Alerts
UPDATE wa_sla_alerts SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_sla_alerts.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.7 Transfers
UPDATE wa_transfers SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_transfers.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.8 Summaries (unique: conversation_id)
DELETE FROM wa_conversation_summaries cs
USING _merge_plan mp
WHERE cs.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM wa_conversation_summaries cs2
    WHERE cs2.conversation_id = mp.canonical_id
  );
UPDATE wa_conversation_summaries SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_conversation_summaries.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.9 AI Tasks
UPDATE wa_ai_tasks SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_ai_tasks.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.10 Satisfaction Ratings
UPDATE wa_satisfaction_ratings SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_satisfaction_ratings.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.11 Followup Logs
UPDATE wa_followup_logs SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_followup_logs.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.12 Auto Reply Log
UPDATE wa_auto_reply_log SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_auto_reply_log.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.13 Cadence Enrollments
UPDATE wa_cadence_enrollments SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_cadence_enrollments.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.14 Internal Threads
UPDATE wa_internal_threads SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_internal_threads.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.15 Preferences (unique: user_id, conversation_id)
DELETE FROM wa_conversation_preferences cp
USING _merge_plan mp
WHERE cp.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM wa_conversation_preferences cp2
    WHERE cp2.conversation_id = mp.canonical_id AND cp2.user_id = cp.user_id
  );
UPDATE wa_conversation_preferences SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_conversation_preferences.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.16 Push Muted (unique: user_id, conversation_id)
DELETE FROM push_muted_conversations pm
USING _merge_plan mp
WHERE pm.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id
  AND EXISTS (
    SELECT 1 FROM push_muted_conversations pm2
    WHERE pm2.conversation_id = mp.canonical_id AND pm2.user_id = pm.user_id
  );
UPDATE push_muted_conversations SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE push_muted_conversations.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.17 Appointments
UPDATE appointments SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE appointments.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- 3.18 Participant Events
UPDATE wa_participant_events SET conversation_id = mp.canonical_id
FROM _merge_plan mp
WHERE wa_participant_events.conversation_id = mp.conv_id
  AND mp.conv_id != mp.canonical_id;

-- ============================================================
-- PHASE 4: ENRICH CANONICAL with best name from absorbed
-- ============================================================
UPDATE wa_conversations c SET
  cliente_nome = COALESCE(
    NULLIF(c.cliente_nome, ''),
    (SELECT absorbed_data->>'cliente_nome'
     FROM _wa_merge_backup b
     WHERE b.canonical_id = c.id
       AND b.absorbed_data->>'cliente_nome' IS NOT NULL
       AND b.absorbed_data->>'cliente_nome' !~ '^\d+$'
     LIMIT 1),
    c.cliente_nome
  )
WHERE c.id IN (SELECT DISTINCT canonical_id FROM _merge_plan);

-- ============================================================
-- PHASE 5: DELETE ABSORBED CONVERSATIONS
-- ============================================================
DELETE FROM wa_conversations
WHERE id IN (
  SELECT conv_id FROM _merge_plan WHERE conv_id != canonical_id
);

-- ============================================================
-- PHASE 6: RECALCULATE AGGREGATES for merged conversations
-- ============================================================
UPDATE wa_conversations c SET
  unread_count = COALESCE(sub.real_unread, 0),
  last_message_at = sub.latest_at,
  last_message_preview = CASE
    WHEN sub.latest_type IS NOT NULL THEN
      CASE sub.latest_type
        WHEN 'image' THEN COALESCE('📷 ' || NULLIF(sub.latest_content, ''), '📷 Imagem')
        WHEN 'video' THEN COALESCE('🎥 ' || NULLIF(sub.latest_content, ''), '🎥 Vídeo')
        WHEN 'audio' THEN '🎵 Áudio'
        WHEN 'ptt' THEN '🎵 Áudio'
        WHEN 'document' THEN COALESCE('📄 ' || NULLIF(sub.latest_content, ''), '📄 Documento')
        WHEN 'sticker' THEN '🎭 Figurinha'
        WHEN 'location' THEN '📍 Localização'
        WHEN 'contact' THEN COALESCE('👤 ' || NULLIF(sub.latest_content, ''), '👤 Contato')
        WHEN 'reaction' THEN COALESCE('👍 ' || NULLIF(sub.latest_content, ''), '👍 Reação')
        ELSE COALESCE(NULLIF(sub.latest_content, ''), 'Mensagem')
      END
    ELSE c.last_message_preview
  END,
  last_message_direction = COALESCE(sub.latest_dir, c.last_message_direction)
FROM (
  SELECT
    m.conversation_id,
    count(*) FILTER (WHERE m.direction = 'in' AND m.status != 'read') as real_unread,
    max(m.created_at) as latest_at,
    (array_agg(m.message_type ORDER BY m.created_at DESC))[1] as latest_type,
    left((array_agg(m.content ORDER BY m.created_at DESC))[1], 100) as latest_content,
    (array_agg(m.direction ORDER BY m.created_at DESC))[1] as latest_dir
  FROM wa_messages m
  WHERE m.conversation_id IN (SELECT DISTINCT canonical_id FROM _merge_plan)
  GROUP BY m.conversation_id
) sub
WHERE c.id = sub.conversation_id;

-- ============================================================
-- PHASE 7: FIX ALL TECHNICAL PREVIEWS
-- ============================================================
UPDATE wa_conversations SET
  last_message_preview = CASE last_message_preview
    WHEN '[text]' THEN 'Mensagem'
    WHEN '[image]' THEN '📷 Imagem'
    WHEN '[video]' THEN '🎥 Vídeo'
    WHEN '[audio]' THEN '🎵 Áudio'
    WHEN '[document]' THEN '📄 Documento'
    WHEN '[sticker]' THEN '🎭 Figurinha'
    WHEN '[location]' THEN '📍 Localização'
    WHEN '[contact]' THEN '👤 Contato'
    WHEN '[reaction]' THEN '👍 Reação'
    ELSE last_message_preview
  END
WHERE last_message_preview IN ('[text]', '[image]', '[video]', '[audio]', '[document]', '[sticker]', '[location]', '[contact]', '[reaction]');

-- ============================================================
-- PHASE 8: FIX NULL NAMES from contacts table
-- ============================================================
UPDATE wa_conversations c SET
  cliente_nome = COALESCE(ct.display_name, ct.name)
FROM contacts ct
WHERE c.cliente_nome IS NULL
  AND c.remote_jid NOT LIKE '%@g.us'
  AND ct.tenant_id = c.tenant_id
  AND ct.phone_e164 = '+' || split_part(c.remote_jid, '@', 1)
  AND COALESCE(ct.display_name, ct.name) IS NOT NULL;

-- Cleanup
DROP TABLE IF EXISTS _merge_plan;
