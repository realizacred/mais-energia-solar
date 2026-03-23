-- Ativar email_billing_enabled para a UC existente
UPDATE unit_billing_email_settings 
SET email_billing_enabled = true, updated_at = now()
WHERE id = '167d5c90-8c95-45b2-842f-a39fb4d39359';