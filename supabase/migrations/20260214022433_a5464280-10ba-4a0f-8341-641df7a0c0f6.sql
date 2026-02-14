-- Add "gif" to allowed message types
ALTER TABLE wa_messages DROP CONSTRAINT wa_messages_message_type_check;
ALTER TABLE wa_messages ADD CONSTRAINT wa_messages_message_type_check 
  CHECK (message_type = ANY (ARRAY['text','image','audio','video','document','sticker','location','contact','reaction','gif']));

-- Reclassify old GIFs stored as "video"
UPDATE wa_messages 
SET message_type = 'gif' 
WHERE message_type = 'video' 
  AND media_mime_type = 'video/mp4' 
  AND content IS NULL;