-- Limpeza do pipeline Comercial (ea4aacc0-b75a-4573-bce6-8006dd27a8be)
-- Remover stages que são nomes de pessoas (criados por engano em migração antiga)
DELETE FROM pipeline_stages
WHERE pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
  AND name IN ('Bruno', 'Sebastiao', 'Escritório', 'Renan');

-- Reposicionar "Fechado" temporariamente para liberar position=5
UPDATE pipeline_stages
SET position = 99
WHERE pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
  AND name = 'Fechado';

-- Inserir "Proposta Aprovada" na posição 5
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position, is_closed, is_won, probability)
VALUES (
  'ea4aacc0-b75a-4573-bce6-8006dd27a8be',
  '17de8315-2e2f-4a79-8751-e5d507d69a41',
  'Proposta Aprovada',
  5, false, false, 85.00
);

-- Mover "Fechado" para posição 6
UPDATE pipeline_stages
SET position = 6
WHERE pipeline_id = 'ea4aacc0-b75a-4573-bce6-8006dd27a8be'
  AND name = 'Fechado';

-- Inserir "Perdido" na posição 7
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position, is_closed, is_won, probability)
VALUES (
  'ea4aacc0-b75a-4573-bce6-8006dd27a8be',
  '17de8315-2e2f-4a79-8751-e5d507d69a41',
  'Perdido',
  7, true, false, 0.00
);