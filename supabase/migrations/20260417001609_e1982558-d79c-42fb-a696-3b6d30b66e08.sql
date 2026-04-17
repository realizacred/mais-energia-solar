-- 1. Apagar o funil Engenharia criado errado
DELETE FROM projeto_etapas
WHERE funil_id IN (
  SELECT id FROM projeto_funis
  WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND nome = 'Engenharia'
);
DELETE FROM projeto_funis
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
AND nome = 'Engenharia';

-- 2. Resetar projetos
UPDATE projetos
SET funil_id = NULL, etapa_id = NULL
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- 3 + 4. Criar 5 funis reais e suas etapas
WITH funis AS (
  INSERT INTO projeto_funis (id, tenant_id, nome, ordem, ativo) VALUES
  (gen_random_uuid(), '17de8315-2e2f-4a79-8751-e5d507d69a41', 'LEAD',        1, true),
  (gen_random_uuid(), '17de8315-2e2f-4a79-8751-e5d507d69a41', 'Engenharia',  2, true),
  (gen_random_uuid(), '17de8315-2e2f-4a79-8751-e5d507d69a41', 'Equipamento', 3, true),
  (gen_random_uuid(), '17de8315-2e2f-4a79-8751-e5d507d69a41', 'Pagamento',   4, true),
  (gen_random_uuid(), '17de8315-2e2f-4a79-8751-e5d507d69a41', 'Compensação', 5, true)
  RETURNING id, nome
)
INSERT INTO projeto_etapas (id, funil_id, tenant_id, nome, cor, ordem, categoria)
SELECT gen_random_uuid(), f.id, '17de8315-2e2f-4a79-8751-e5d507d69a41', e.nome, e.cor, e.ordem, e.cat::projeto_etapa_categoria
FROM funis f
JOIN (VALUES
  ('LEAD', 'Recebido',        '#6366f1', 1, 'aberto'),
  ('LEAD', 'Qualificado',     '#8b5cf6', 2, 'aberto'),
  ('LEAD', 'Enviar Proposta', '#a78bfa', 3, 'aberto'),
  ('LEAD', 'Proposta enviada','#f59e0b', 4, 'aberto'),
  ('LEAD', 'Negociação',      '#f97316', 5, 'aberto'),
  ('LEAD', 'Fechado',         '#22c55e', 6, 'ganho'),
  ('Engenharia', 'Elaboração do Projeto',  '#6366f1', 1,  'aberto'),
  ('Engenharia', 'Falta Documentos',       '#ef4444', 2,  'aberto'),
  ('Engenharia', 'Falta dados técnicos',   '#f97316', 3,  'aberto'),
  ('Engenharia', 'Projeto Enviado',        '#f59e0b', 4,  'aberto'),
  ('Engenharia', 'Projetos Aprovados',     '#10b981', 5,  'aberto'),
  ('Engenharia', 'Projeto em andamento',   '#14b8a6', 6,  'aberto'),
  ('Engenharia', 'Etapa de Obra',          '#06b6d4', 7,  'aberto'),
  ('Engenharia', 'Vistoria',               '#8b5cf6', 8,  'aberto'),
  ('Engenharia', 'Pagamento TRT',          '#a78bfa', 9,  'aberto'),
  ('Engenharia', 'Finalizado',             '#22c55e', 10, 'ganho'),
  ('Equipamento', 'Fazer Pedido',        '#6366f1', 1, 'aberto'),
  ('Equipamento', 'Pedido Efetuado',     '#8b5cf6', 2, 'aberto'),
  ('Equipamento', 'Pedido Pago',         '#f59e0b', 3, 'aberto'),
  ('Equipamento', 'Deposito',            '#f97316', 4, 'aberto'),
  ('Equipamento', 'Em Andamento',        '#14b8a6', 5, 'aberto'),
  ('Equipamento', 'Cliente',             '#06b6d4', 6, 'aberto'),
  ('Equipamento', 'Instalação Realizada','#10b981', 7, 'aberto'),
  ('Equipamento', 'Sistema em Operação', '#22c55e', 8, 'ganho'),
  ('Pagamento', 'Não Pago', '#ef4444', 1, 'aberto'),
  ('Pagamento', 'Pago',     '#22c55e', 2, 'ganho'),
  ('Compensação', 'Recebido',             '#6366f1', 1, 'aberto'),
  ('Compensação', 'Compensação enviada',  '#f59e0b', 2, 'aberto'),
  ('Compensação', 'Compensação aceita',   '#22c55e', 3, 'ganho')
) AS e(funil_nome, nome, cor, ordem, cat) ON f.nome = e.funil_nome;