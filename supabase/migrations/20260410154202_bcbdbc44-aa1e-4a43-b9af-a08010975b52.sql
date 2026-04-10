-- Fix corrupted messages from ephemeralMessage crash bug

-- Text messages with null content
UPDATE wa_messages
SET content = '[mensagem não disponível]'
WHERE message_type = 'text' AND content IS NULL;

-- Media messages with null content AND null media_url
UPDATE wa_messages
SET content = '[mídia não disponível]'
WHERE message_type IN ('audio', 'image', 'video', 'gif', 'sticker')
  AND content IS NULL
  AND media_url IS NULL;

-- Contact messages with null content
UPDATE wa_messages
SET content = '[contato compartilhado]'
WHERE message_type = 'contact' AND content IS NULL;