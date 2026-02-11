-- Mover mensagens da conversa duplicada para a principal
UPDATE wa_messages 
SET conversation_id = 'fa965246-495c-439c-a7a9-0eb4f6a24c13'
WHERE conversation_id = 'd6daf453-6223-4b40-89fa-ae9a8a40e551';

-- Fechar a conversa duplicada
UPDATE wa_conversations 
SET status = 'resolved', updated_at = now()
WHERE id = 'd6daf453-6223-4b40-89fa-ae9a8a40e551';