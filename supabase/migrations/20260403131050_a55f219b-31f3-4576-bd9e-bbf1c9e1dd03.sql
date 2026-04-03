
-- Consultores padrão
INSERT INTO consultores (tenant_id, nome, telefone, ativo)
SELECT t.id, c.nome, c.tel, true
FROM tenants t
CROSS JOIN (VALUES
  ('BRUNO BANDEIRA', '00000000001'),
  ('Claudia',        '00000000002'),
  ('Diego',          '00000000003'),
  ('Ian Souza',      '00000000004'),
  ('Renan',          '00000000005'),
  ('Sebastião',      '00000000006'),
  ('Não Definido',   '00000000007')
) c(nome, tel)
ON CONFLICT DO NOTHING;

-- Pipelines padrão (sem coluna position)
INSERT INTO pipelines (tenant_id, name, kind, is_active)
SELECT t.id, p.name, 'process', true
FROM tenants t
CROSS JOIN (VALUES ('Comercial'), ('Engenharia')) p(name)
ON CONFLICT DO NOTHING;

-- Stages Comercial
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position)
SELECT p.id, p.tenant_id, s.name, s.pos
FROM pipelines p
CROSS JOIN (VALUES
  ('Prospecção',1),
  ('Qualificação',2),
  ('Proposta Enviada',3),
  ('Negociação',4),
  ('Ganho',5),
  ('Perdido',6)
) s(name,pos)
WHERE p.name = 'Comercial'
ON CONFLICT DO NOTHING;

-- Stages Engenharia
INSERT INTO pipeline_stages (pipeline_id, tenant_id, name, position)
SELECT p.id, p.tenant_id, s.name, s.pos
FROM pipelines p
CROSS JOIN (VALUES
  ('Falta Documentos',1),
  ('Falta dados técnicos',2),
  ('Elaboração do Projeto',3),
  ('Pagamento TRT',4),
  ('Projeto em andamento',5),
  ('Projeto Enviado',6),
  ('Etapa de Obra',7),
  ('Projetos Aprovados',8),
  ('Vistoria',9),
  ('Finalizado',10),
  ('Perdido',11)
) s(name,pos)
WHERE p.name = 'Engenharia'
ON CONFLICT DO NOTHING;
