-- TAREFA 1: Add projeto_id to recebimentos
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS
  projeto_id UUID REFERENCES projetos(id);

CREATE INDEX IF NOT EXISTS idx_recebimentos_projeto
  ON recebimentos(projeto_id);

-- TAREFA 2: Trigger to auto-create recebimento + parcelas on proposta aceita
CREATE OR REPLACE FUNCTION trg_proposta_aceita_recebimento()
RETURNS TRIGGER AS $$
DECLARE
  v_valor NUMERIC;
  v_cliente_id UUID;
  v_projeto_id UUID;
  v_parcelas INT := 3;
  v_recebimento_id UUID;
  v_tenant_id UUID;
  i INT;
BEGIN
  IF NEW.status = 'aceita' AND
     (OLD.status IS NULL OR OLD.status != 'aceita') THEN

    -- Buscar valor da última versão
    SELECT pv.valor_total INTO v_valor
    FROM proposta_versoes pv
    WHERE pv.proposta_id = NEW.id
    ORDER BY pv.created_at DESC LIMIT 1;

    v_cliente_id := NEW.cliente_id;
    v_projeto_id := NEW.projeto_id;
    v_tenant_id  := NEW.tenant_id;

    IF v_valor > 0 AND v_cliente_id IS NOT NULL THEN
      -- Criar recebimento
      INSERT INTO recebimentos (
        tenant_id, cliente_id, projeto_id,
        valor_total, numero_parcelas,
        forma_pagamento_acordada,
        data_acordo, status, descricao
      ) VALUES (
        v_tenant_id, v_cliente_id, v_projeto_id,
        v_valor, v_parcelas,
        'a_definir',
        NOW(), 'pendente',
        'Recebimento automático — Proposta ' || COALESCE(NEW.codigo, '')
      ) RETURNING id INTO v_recebimento_id;

      -- Criar parcelas mensais
      FOR i IN 1..v_parcelas LOOP
        INSERT INTO parcelas (
          tenant_id, recebimento_id, numero_parcela,
          valor, data_vencimento, status
        ) VALUES (
          v_tenant_id, v_recebimento_id, i,
          ROUND(v_valor / v_parcelas, 2),
          (NOW() + (i || ' months')::INTERVAL)::DATE,
          'pendente'
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_proposta_aceita_recebimento
AFTER UPDATE ON propostas_nativas
FOR EACH ROW
EXECUTE FUNCTION trg_proposta_aceita_recebimento();