-- Corrigir o evolution_instance_key que contém a API Key em vez do nome da instância
UPDATE wa_instances 
SET evolution_instance_key = 'Mais Energia Solar',
    updated_at = now()
WHERE evolution_instance_key = '66BC88BEEC44-425B-9817-F9E727A4ADDB';