-- Add "Aguardando Documentação" status for leads with incomplete documentation
INSERT INTO lead_status (id, nome, cor, ordem)
SELECT gen_random_uuid(), 'Aguardando Documentação', '#f59e0b', 6
WHERE NOT EXISTS (
  SELECT 1 FROM lead_status WHERE nome = 'Aguardando Documentação'
);