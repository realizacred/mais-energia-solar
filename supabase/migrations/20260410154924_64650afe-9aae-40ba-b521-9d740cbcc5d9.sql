-- Backfill cliente_nome from leads
UPDATE wa_conversations wc
SET cliente_nome = l.nome
FROM leads l
WHERE wc.cliente_nome IS NULL
  AND l.nome IS NOT NULL
  AND l.tenant_id = wc.tenant_id
  AND (
    REGEXP_REPLACE(wc.cliente_telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g')
    OR REGEXP_REPLACE(wc.remote_jid, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(l.telefone, '[^0-9]', '', 'g') || '%'
  );

-- Backfill cliente_nome from clientes (where still null after leads)
UPDATE wa_conversations wc
SET cliente_nome = c.nome
FROM clientes c
WHERE wc.cliente_nome IS NULL
  AND c.nome IS NOT NULL
  AND c.tenant_id = wc.tenant_id
  AND (
    REGEXP_REPLACE(wc.cliente_telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g')
    OR REGEXP_REPLACE(wc.remote_jid, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(c.telefone, '[^0-9]', '', 'g') || '%'
  );

-- Backfill last_message_preview from latest wa_message
UPDATE wa_conversations wc
SET last_message_preview = sub.preview
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    CASE
      WHEN m.message_type = 'audio' THEN '🎵 Áudio'
      WHEN m.message_type = 'image' THEN '📷 Imagem'
      WHEN m.message_type = 'video' THEN '🎥 Vídeo'
      WHEN m.message_type = 'document' THEN '📄 Documento'
      WHEN m.message_type = 'sticker' THEN '🎭 Figurinha'
      WHEN m.message_type = 'location' THEN '📍 Localização'
      ELSE COALESCE(LEFT(m.content, 80), '...')
    END AS preview
  FROM wa_messages m
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE wc.id = sub.conversation_id
  AND wc.last_message_preview IS NULL;