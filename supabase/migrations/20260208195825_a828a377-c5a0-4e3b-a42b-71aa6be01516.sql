-- Insert default lead statuses that are required by the system
INSERT INTO lead_status (nome, cor, ordem) VALUES
  ('Novo', '#3b82f6', 1),
  ('Em Contato', '#8b5cf6', 2),
  ('Proposta Enviada', '#f59e0b', 3),
  ('Aguardando Documentação', '#f97316', 4),
  ('Aguardando Validação', '#06b6d4', 5),
  ('Convertido', '#22c55e', 6),
  ('Perdido', '#ef4444', 7)
ON CONFLICT DO NOTHING;