
INSERT INTO public.estoque_categorias (tenant_id, nome, slug, parent_id, ordem, ativo)
SELECT p.tenant_id, cat.nome, cat.slug, NULL, cat.ordem, true
FROM (
  VALUES
    ('Módulo Solar', 'modulo_solar', 1),
    ('Inversor', 'inversor', 2),
    ('Cabo', 'cabo', 3),
    ('Estrutura', 'estrutura', 4),
    ('Conector', 'conector', 5),
    ('Proteção Elétrica', 'protecao_eletrica', 6),
    ('Ferramentas', 'ferramentas', 7),
    ('EPI', 'epi', 8),
    ('Outros', 'outros', 99)
) AS cat(nome, slug, ordem)
CROSS JOIN (SELECT DISTINCT tenant_id FROM public.profiles WHERE tenant_id IS NOT NULL) p
ON CONFLICT DO NOTHING;
