
-- Pegar o tenant_id existente dos funis
DO $$
DECLARE
  v_tenant_id uuid;
  v_funil_id uuid;
BEGIN
  -- Pegar tenant dos funis existentes
  SELECT tenant_id INTO v_tenant_id FROM projeto_funis LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum tenant encontrado em projeto_funis';
  END IF;

  -- Verificar se já existe um funil Comercial
  SELECT id INTO v_funil_id FROM projeto_funis WHERE nome = 'Comercial' AND tenant_id = v_tenant_id;
  
  IF v_funil_id IS NOT NULL THEN
    RAISE NOTICE 'Funil Comercial já existe: %', v_funil_id;
  ELSE
    -- Criar funil Comercial
    INSERT INTO projeto_funis (tenant_id, nome, ativo, ordem)
    VALUES (v_tenant_id, 'Comercial', true, 0)
    RETURNING id INTO v_funil_id;

    -- Criar as 6 etapas do LEAD
    INSERT INTO projeto_etapas (funil_id, tenant_id, nome, ordem) VALUES
      (v_funil_id, v_tenant_id, 'Recebido', 0),
      (v_funil_id, v_tenant_id, 'Enviar Proposta', 1),
      (v_funil_id, v_tenant_id, 'Proposta Enviada', 2),
      (v_funil_id, v_tenant_id, 'Qualificado', 3),
      (v_funil_id, v_tenant_id, 'Negociação', 4),
      (v_funil_id, v_tenant_id, 'Fechado', 5);
  END IF;

  -- Reordenar: Comercial=0, Vendedor=1 (inativo), Engenharia=2, Equipamento=3, Compensação=4, Pagamento=5, SDR=6
  UPDATE projeto_funis SET ordem = 0 WHERE nome = 'Comercial' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 1 WHERE nome = 'Vendedor' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 2 WHERE nome = 'Engenharia' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 3 WHERE nome = 'Equipamento' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 4 WHERE nome = 'Compensação' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 5 WHERE nome = 'Pagamento' AND tenant_id = v_tenant_id;
  UPDATE projeto_funis SET ordem = 6 WHERE nome = 'SDR / Prospecção' AND tenant_id = v_tenant_id;
END $$;
