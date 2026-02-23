-- Inserir status "Arquivado" para todos os tenants existentes
INSERT INTO lead_status (nome, cor, ordem, tenant_id)
SELECT 'Arquivado', '#6b7280', 8, t.id
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM lead_status ls WHERE ls.tenant_id = t.id AND ls.nome = 'Arquivado'
);