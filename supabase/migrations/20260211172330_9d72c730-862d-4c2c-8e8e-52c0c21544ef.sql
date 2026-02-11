-- Reatribuir conversa de Bruno Bandeira (instância "Mais Energia Solar") para Renan
-- Conversa: fa965246-495c-439c-a7a9-0eb4f6a24c13
-- De: Claudia (53ada1fb-9356-47df-a0cb-7d490f5facba)
-- Para: Renan (b1f36ac8-3941-4892-b990-52b80677f064)
UPDATE wa_conversations 
SET assigned_to = 'b1f36ac8-3941-4892-b990-52b80677f064', updated_at = now()
WHERE id = 'fa965246-495c-439c-a7a9-0eb4f6a24c13';