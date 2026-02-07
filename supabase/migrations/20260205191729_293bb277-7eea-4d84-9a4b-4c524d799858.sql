-- Permitir lead_id nulo na tabela whatsapp_messages para mensagens manuais
-- que podem ser enviadas sem associação a um lead específico
ALTER TABLE public.whatsapp_messages 
ALTER COLUMN lead_id DROP NOT NULL;