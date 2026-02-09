-- Corrigir evolution_instance na tabela de automação para apontar para o nome correto
UPDATE whatsapp_automation_config 
SET evolution_instance = 'Mais Energia Solar',
    evolution_api_key = NULL,
    updated_at = now()
WHERE evolution_instance = '66BC88BEEC44-425B-9817-F9E727A4ADDB';