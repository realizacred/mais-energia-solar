-- Corrigir conversa órfã: Bruno (553288612560) na instância Escritorio
-- Renan não tem acesso a essa instância, Claudia sim
UPDATE wa_conversations 
SET assigned_to = '53ada1fb-9356-47df-a0cb-7d490f5facba', updated_at = now()
WHERE id = '6881c6a3-33b1-4700-b80d-7bdf5d04961a';