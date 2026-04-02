-- Activate the Vendedor pipeline
UPDATE pipelines SET is_active = true
WHERE id = '54f3559c-b38e-4aa3-beaa-e773cbecb4e0';

-- Add missing stages to Vendedor pipeline
-- Existing: Bruno(0), Claudia(1), Renan(2), Sebastiao(3)
-- Missing: Escritório(4), Ian(5), Diego(6), Rogerio(7), Ricardo(8)
INSERT INTO pipeline_stages (tenant_id, pipeline_id, name, position, probability, is_closed, is_won)
VALUES
  ('00000000-0000-0000-0000-000000000001', '54f3559c-b38e-4aa3-beaa-e773cbecb4e0', 'Escritório', 4, 50, false, false),
  ('00000000-0000-0000-0000-000000000001', '54f3559c-b38e-4aa3-beaa-e773cbecb4e0', 'Ian', 5, 50, false, false),
  ('00000000-0000-0000-0000-000000000001', '54f3559c-b38e-4aa3-beaa-e773cbecb4e0', 'Diego', 6, 50, false, false),
  ('00000000-0000-0000-0000-000000000001', '54f3559c-b38e-4aa3-beaa-e773cbecb4e0', 'Rogerio', 7, 50, false, false),
  ('00000000-0000-0000-0000-000000000001', '54f3559c-b38e-4aa3-beaa-e773cbecb4e0', 'Ricardo', 8, 50, false, false)
ON CONFLICT DO NOTHING;