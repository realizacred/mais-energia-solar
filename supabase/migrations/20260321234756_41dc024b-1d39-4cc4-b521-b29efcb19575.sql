-- Insert default planos de serviço for active tenants
INSERT INTO planos_servico (tenant_id, nome, descricao, valor, tipo)
SELECT t.id, p.nome, p.descricao, p.valor, p.tipo
FROM tenants t
CROSS JOIN (VALUES
  ('Monitoramento Basic', 'Monitoramento solar básico - 1 usina', 49.90, 'monitoramento'),
  ('Monitoramento Pro', 'Monitoramento solar completo - até 5 usinas', 89.90, 'monitoramento'),
  ('Monitoramento Enterprise', 'Monitoramento ilimitado + relatórios', 149.90, 'monitoramento')
) AS p(nome, descricao, valor, tipo)
WHERE t.status = 'active'
AND t.nome NOT IN ('Teste', 'teste1')
AND NOT EXISTS (
  SELECT 1 FROM planos_servico ps WHERE ps.tenant_id = t.id AND ps.nome = p.nome
);