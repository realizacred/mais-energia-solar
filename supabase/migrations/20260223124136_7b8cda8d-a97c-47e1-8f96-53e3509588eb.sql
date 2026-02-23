-- Fix typo in Claudia's email (maisenerigasolar -> maisenergiasolar)
UPDATE auth.users 
SET email = 'claudiasouza@maisenergiasolar.com.br'
WHERE id = '53ada1fb-9356-47df-a0cb-7d490f5facba'
  AND email = 'claudiasouza@maisenerigasolar.com.br';
