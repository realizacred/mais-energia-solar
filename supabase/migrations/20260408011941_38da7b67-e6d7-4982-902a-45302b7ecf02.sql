-- Fix is_principal=false on proposals with status 'aceita'
-- These should have been set by proposal-transition but weren't
UPDATE propostas_nativas
SET is_principal = true
WHERE status = 'aceita'
  AND is_principal = false;