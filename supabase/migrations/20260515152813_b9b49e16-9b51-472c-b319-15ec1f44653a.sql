-- Função para integrar cheque compensado ao financeiro (pagamentos)
CREATE OR REPLACE FUNCTION public.fn_cheque_compensacao_integra()
RETURNS TRIGGER AS $$
BEGIN
    -- Só age se o status mudou para 'compensado'
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'compensado') THEN
        -- Verificar se já existe um pagamento vinculado para este cheque (evitar duplicidade)
        IF EXISTS (SELECT 1 FROM public.pagamentos WHERE numero_cheque = NEW.numero_cheque AND tenant_id = NEW.tenant_id AND data_pagamento = NEW.data_compensacao AND valor_pago = NEW.valor) THEN
            RETURN NEW;
        END IF;

        -- Se o cheque estiver vinculado a um recebimento ou parcela, cria o pagamento
        IF (NEW.recebimento_id IS NOT NULL) THEN
            INSERT INTO public.pagamentos (
                tenant_id,
                recebimento_id,
                parcela_id,
                valor_pago,
                forma_pagamento,
                data_pagamento,
                numero_cheque,
                observacoes
            ) VALUES (
                NEW.tenant_id,
                NEW.recebimento_id,
                NEW.parcela_id,
                NEW.valor,
                'cheque',
                COALESCE(NEW.data_compensacao, CURRENT_DATE),
                NEW.numero_cheque,
                'Compensação automática de cheque: ' || NEW.numero_cheque
            );
            
            -- Atualiza o pagamento_id no cheque para manter o vínculo reverso
            -- Usamos UPDATE direto aqui; como estamos em um trigger AFTER, precisamos de cuidado
            -- Mas o ideal é que o cheque saiba qual pagamento ele gerou.
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER UPDATE para integração
CREATE TRIGGER tr_cheque_compensacao_integra
AFTER UPDATE ON public.cheques
FOR EACH ROW EXECUTE FUNCTION public.fn_cheque_compensacao_integra();
