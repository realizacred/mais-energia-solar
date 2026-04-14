
-- Tenant fixo
DO $$
DECLARE
  v_tenant_id uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_eng_funil_id uuid := '9426cec6-e77d-4d11-8629-ec7f384d344c';
  v_equip_funil_id uuid;
  v_comp_funil_id uuid;
  v_pag_funil_id uuid;
BEGIN
  -- =============================================
  -- 1. Deletar etapas genéricas do funil Engenharia (Novo, Em Andamento, Ganho, Perdido)
  --    Não há projetos vinculados (tabela projetos vazia)
  -- =============================================
  DELETE FROM projeto_etapas WHERE funil_id = v_eng_funil_id;

  -- 2. Inserir etapas detalhadas do SM no funil Engenharia
  INSERT INTO projeto_etapas (funil_id, tenant_id, nome, cor, ordem, categoria) VALUES
    (v_eng_funil_id, v_tenant_id, 'Falta Documentos',       '#EF4444', 0, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Falta Dados Técnicos',   '#F59E0B', 1, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Elaboração do Projeto',  '#3B82F6', 2, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Pagamento TRT',          '#8B5CF6', 3, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Projeto em Andamento',   '#F59E0B', 4, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Projeto Enviado',        '#06B6D4', 5, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Etapa de Obra',          '#D97706', 6, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Projetos Aprovados',     '#10B981', 7, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Vistoria',               '#6366F1', 8, 'aberto'),
    (v_eng_funil_id, v_tenant_id, 'Finalizado',             '#10B981', 9, 'ganho');

  -- =============================================
  -- 3. Criar funil Equipamento
  -- =============================================
  INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
  VALUES (v_tenant_id, 'Equipamento', 2, true)
  RETURNING id INTO v_equip_funil_id;

  INSERT INTO projeto_etapas (funil_id, tenant_id, nome, cor, ordem, categoria) VALUES
    (v_equip_funil_id, v_tenant_id, 'Em Andamento',           '#F59E0B', 0, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Fazer Pedido',           '#3B82F6', 1, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Pedido Efetuado',        '#8B5CF6', 2, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Pedido Pago',            '#10B981', 3, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Depósito',               '#06B6D4', 4, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Cliente',                '#D97706', 5, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Instalação Realizada',   '#10B981', 6, 'aberto'),
    (v_equip_funil_id, v_tenant_id, 'Sistema em Operação',    '#10B981', 7, 'ganho');

  -- =============================================
  -- 4. Criar funil Compensação
  -- =============================================
  INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
  VALUES (v_tenant_id, 'Compensação', 3, true)
  RETURNING id INTO v_comp_funil_id;

  INSERT INTO projeto_etapas (funil_id, tenant_id, nome, cor, ordem, categoria) VALUES
    (v_comp_funil_id, v_tenant_id, 'Recebido',              '#3B82F6', 0, 'aberto'),
    (v_comp_funil_id, v_tenant_id, 'Compensação Enviada',   '#F59E0B', 1, 'aberto'),
    (v_comp_funil_id, v_tenant_id, 'Compensação Aceita',    '#10B981', 2, 'ganho');

  -- =============================================
  -- 5. Criar funil Pagamento
  -- =============================================
  INSERT INTO projeto_funis (tenant_id, nome, ordem, ativo)
  VALUES (v_tenant_id, 'Pagamento', 4, true)
  RETURNING id INTO v_pag_funil_id;

  INSERT INTO projeto_etapas (funil_id, tenant_id, nome, cor, ordem, categoria) VALUES
    (v_pag_funil_id, v_tenant_id, 'Não Pago',  '#EF4444', 0, 'aberto'),
    (v_pag_funil_id, v_tenant_id, 'Pago',      '#10B981', 1, 'ganho');
END $$;
