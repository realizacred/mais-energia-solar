-- Função para impedir delete e update em cheque_movimentacoes
CREATE OR REPLACE FUNCTION public.fn_block_cheque_movement_mod()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Movimentações de cheques são imutáveis e não podem ser alteradas ou excluídas.';
END;
$$ LANGUAGE plpgsql;

-- Trigger para impedir delete
CREATE TRIGGER tr_block_cheque_movement_delete
BEFORE DELETE ON public.cheque_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_block_cheque_movement_mod();

-- Trigger para impedir update (exceto metadados se necessário, mas aqui vamos bloquear tudo por segurança)
CREATE TRIGGER tr_block_cheque_movement_update
BEFORE UPDATE ON public.cheque_movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_block_cheque_movement_mod();
