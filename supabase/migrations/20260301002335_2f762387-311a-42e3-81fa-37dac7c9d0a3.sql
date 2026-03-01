
-- Deslinkar TUDO primeiro, depois deletar

-- 1. Deslinkar propostas nativas de deals
UPDATE propostas_nativas SET deal_id = NULL WHERE origem = 'imported';

-- 2. Deslinkar projetos de deals
UPDATE projetos SET deal_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');

-- 3. Deletar deals vinculados ao cliente SM
DELETE FROM deals WHERE customer_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');

-- 4. Deletar propostas migradas (versões primeiro)
DELETE FROM proposta_versoes WHERE proposta_id IN (SELECT id FROM propostas_nativas WHERE origem = 'imported');
DELETE FROM propostas_nativas WHERE origem = 'imported';

-- 5. Deletar dependências do cliente SM
DELETE FROM checklists_cliente WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');
DELETE FROM checklists_instalador WHERE projeto_id IN (SELECT id FROM projetos WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%'));
DELETE FROM comissoes WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');
DELETE FROM appointments WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');

-- 6. Deletar projetos SM
DELETE FROM projetos WHERE cliente_id IN (SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%');

-- 7. Deletar clientes SM
DELETE FROM clientes WHERE cliente_code LIKE 'SM-%';

-- 8. Resetar flag de migração
UPDATE solar_market_proposals SET migrar_para_canonico = false, migrar_requested_at = NULL, migrar_requested_by = NULL;

-- 9. CORRIGIR BUG: sm_client_id = -1 → resolver via projeto
UPDATE solar_market_proposals pr
SET sm_client_id = p.sm_client_id
FROM solar_market_projects p
WHERE pr.sm_project_id = p.sm_project_id
  AND p.sm_client_id IS NOT NULL
  AND (pr.sm_client_id = -1 OR pr.sm_client_id IS NULL);

-- 10. Limpar -1 restantes
UPDATE solar_market_proposals SET sm_client_id = NULL WHERE sm_client_id = -1;
