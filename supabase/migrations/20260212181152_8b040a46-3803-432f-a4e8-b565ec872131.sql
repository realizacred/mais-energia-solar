-- Índice para performance do Inbox por vendedor (identificado na auditoria)
CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned_to 
  ON wa_conversations (assigned_to) 
  WHERE assigned_to IS NOT NULL;