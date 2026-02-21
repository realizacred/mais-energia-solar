
-- Auto-populate BT subgroups (B1, B2, B3) from existing concessionarias data
-- Each concessionária gets 3 rows: B1, B2, B3 with same tarifa (convencional BT)
INSERT INTO concessionaria_tarifas_subgrupo (concessionaria_id, tenant_id, subgrupo, modalidade_tarifaria, tarifa_energia, tarifa_fio_b, origem, is_active)
SELECT c.id, c.tenant_id, sub.subgrupo, 'Convencional', c.tarifa_energia, c.tarifa_fio_b, 'auto_seed', true
FROM concessionarias c
CROSS JOIN (SELECT unnest(ARRAY['B1','B2','B3']) AS subgrupo) sub
WHERE c.ativo = true
ON CONFLICT DO NOTHING;
