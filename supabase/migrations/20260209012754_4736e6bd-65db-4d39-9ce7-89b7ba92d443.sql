INSERT INTO wa_tags (name, color) VALUES 
  ('Urgente', '#ef4444'),
  ('Aguardando retorno', '#f97316'),
  ('Interessado', '#22c55e'),
  ('Orçamento enviado', '#06b6d4'),
  ('Fechamento', '#a855f7')
ON CONFLICT DO NOTHING;