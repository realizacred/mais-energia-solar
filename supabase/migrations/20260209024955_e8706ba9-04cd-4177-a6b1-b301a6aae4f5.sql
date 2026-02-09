-- Enable Realtime for WhatsApp inbox tables
ALTER PUBLICATION supabase_realtime ADD TABLE wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversation_messages;