-- Backfill: mark existing group conversations
UPDATE wa_conversations SET is_group = true WHERE remote_jid LIKE '%@g.us%' AND is_group = false;