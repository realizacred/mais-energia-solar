-- Clean up incorrectly created equipe_sem_resposta follow-ups 
-- where the last message was actually outbound (our team sent last)
DELETE FROM wa_followup_queue
WHERE rule_id IN (
  SELECT id FROM wa_followup_rules WHERE cenario = 'equipe_sem_resposta'
)
AND conversation_id IN (
  SELECT DISTINCT wc.id
  FROM wa_conversations wc
  WHERE wc.id IN (SELECT conversation_id FROM wa_followup_queue)
  AND (
    SELECT wm.direction FROM wa_messages wm
    WHERE wm.conversation_id = wc.id AND wm.is_internal_note = false
    ORDER BY wm.created_at DESC LIMIT 1
  ) = 'out'
);