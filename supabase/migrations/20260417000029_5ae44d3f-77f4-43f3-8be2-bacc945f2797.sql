DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_funil uuid;
  v_e_aguardando uuid;
BEGIN
  SELECT id INTO v_funil FROM projeto_funis
  WHERE tenant_id = v_tenant AND nome = 'Engenharia' LIMIT 1;

  IF v_funil IS NULL THEN
    INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
    VALUES (v_tenant, 'Engenharia', 1, true)
    RETURNING id INTO v_funil;
  END IF;

  INSERT INTO projeto_etapas (funil_id, tenant_id, nome, cor, ordem, categoria) VALUES
    (v_funil, v_tenant, 'Aguardando Documentos',   '#6366f1', 1,  'aberto'),
    (v_funil, v_tenant, 'Análise Técnica',         '#8b5cf6', 2,  'aberto'),
    (v_funil, v_tenant, 'Projeto Elétrico',        '#a78bfa', 3,  'aberto'),
    (v_funil, v_tenant, 'Aprovação Concessionária','#f59e0b', 4,  'aberto'),
    (v_funil, v_tenant, 'Aguardando Equipamentos', '#f97316', 5,  'aberto'),
    (v_funil, v_tenant, 'Instalação',              '#10b981', 6,  'aberto'),
    (v_funil, v_tenant, 'Vistoria',                '#14b8a6', 7,  'aberto'),
    (v_funil, v_tenant, 'Homologação',             '#06b6d4', 8,  'aberto'),
    (v_funil, v_tenant, 'Sistema em Operação',     '#22c55e', 9,  'ganho'),
    (v_funil, v_tenant, 'Compensação Aceita',      '#16a34a', 10, 'ganho'),
    (v_funil, v_tenant, 'Finalizado',              '#15803d', 11, 'ganho')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_e_aguardando FROM projeto_etapas
  WHERE funil_id = v_funil AND nome = 'Aguardando Documentos';

  UPDATE projetos SET funil_id = v_funil, etapa_id = v_e_aguardando
  WHERE tenant_id = v_tenant AND (funil_id IS NULL OR etapa_id IS NULL);
END $$;

SELECT pe.nome AS etapa, pe.ordem, COUNT(p.id) AS total_projetos
FROM projeto_etapas pe
LEFT JOIN projetos p ON p.etapa_id = pe.id
WHERE pe.funil_id = (SELECT id FROM projeto_funis
  WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41' AND nome = 'Engenharia')
GROUP BY pe.nome, pe.ordem ORDER BY pe.ordem;