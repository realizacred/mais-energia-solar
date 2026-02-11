-- Consolidar: fechar conversa duplicada de Bruno Bandeira na instância Escritorio
-- Mantém apenas a conversa na instância "Mais Energia Solar" (Renan) como ativa
UPDATE wa_conversations 
SET status = 'resolved', updated_at = now()
WHERE id = 'a6022dc9-5513-4db2-a3ad-e8eb2699bd5f';