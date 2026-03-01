
-- SECURITY FIX: Remove plain-text passwords from monitoring_integrations credentials JSONB
-- This is a one-time data cleanup for existing records that had password stored
UPDATE monitoring_integrations 
SET credentials = credentials - 'password' - 'userPassword' - 'senha',
    updated_at = now()
WHERE credentials::text LIKE '%password%' 
   OR credentials::text LIKE '%userPassword%' 
   OR credentials::text LIKE '%senha%';
