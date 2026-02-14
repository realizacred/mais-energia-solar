CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_conv_instance_remote_uniq
ON wa_conversations (instance_id, remote_jid);