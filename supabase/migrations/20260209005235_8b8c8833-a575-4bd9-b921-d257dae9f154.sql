-- Corrigir definitivamente o evolution_instance_key na tabela wa_instances
-- O valor deve ser o NOME da instância no Evolution API, NÃO a API Key
UPDATE wa_instances 
SET evolution_instance_key = 'Mais Energia Solar',
    updated_at = now()
WHERE id = 'b3dee245-4b09-4d03-8c63-006b05d99b41';

-- Corrigir também na tabela de automação
UPDATE whatsapp_automation_config 
SET evolution_instance = 'Mais Energia Solar',
    updated_at = now()
WHERE evolution_instance = '66BC88BEEC44-425B-9817-F9E727A4ADDB';