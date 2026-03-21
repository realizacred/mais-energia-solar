
-- Correct order: projetos → deals → clientes, then leads

-- 1. Remove projetos linked to test client's deals
DELETE FROM projetos WHERE deal_id IN (
  SELECT id FROM deals WHERE customer_id IN (
    SELECT id FROM clientes WHERE nome ILIKE '%teste%' OR nome ILIKE '%test%'
  )
);

-- 2. Remove remaining projetos linked directly to test client
DELETE FROM projetos WHERE cliente_id IN (
  SELECT id FROM clientes WHERE nome ILIKE '%teste%' OR nome ILIKE '%test%'
);

-- 3. Remove deals for test client
DELETE FROM deals WHERE customer_id IN (
  SELECT id FROM clientes WHERE nome ILIKE '%teste%' OR nome ILIKE '%test%'
);

-- 4. Remove test client
DELETE FROM clientes WHERE nome ILIKE '%teste%' OR nome ILIKE '%test%';

-- 5. Remove lead_scores for test leads
DELETE FROM lead_scores WHERE lead_id IN (
  SELECT id FROM leads WHERE (nome ILIKE '%teste%' OR nome ILIKE '%test%')
);

-- 6. Remove lead_audit_log for test leads
DELETE FROM lead_audit_log WHERE lead_id IN (
  SELECT id FROM leads WHERE (nome ILIKE '%teste%' OR nome ILIKE '%test%')
);

-- 7. Hard-delete test leads
DELETE FROM leads WHERE (nome ILIKE '%teste%' OR nome ILIKE '%test%');
