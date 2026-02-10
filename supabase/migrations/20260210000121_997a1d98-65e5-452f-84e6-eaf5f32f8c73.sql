-- Deactivate test tenants so anonymous inserts resolve correctly
UPDATE tenants SET ativo = false WHERE nome IN ('Teste', 'teste1');