
-- Fix: Admin user 'teste1' has ativo=false, blocking all RLS queries
UPDATE profiles 
SET ativo = true 
WHERE user_id = 'bcd36a45-89b3-46ce-bd9d-f6d7dd744a5e' 
AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
