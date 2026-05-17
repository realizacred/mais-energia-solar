CREATE OR REPLACE FUNCTION public.check_document_used_in_locked_credit()
RETURNS TRIGGER AS $$
BEGIN
    -- Corrigido: a coluna na tabela analise_credito_documentos chama-se 'file_id' e não 'project_document_id'
    IF EXISTS (
        SELECT 1 
        FROM public.analise_credito_documentos ad
        JOIN public.analise_credito ac ON ad.analise_credito_id = ac.id
        WHERE ad.file_id = OLD.id 
        AND ac.is_locked = true
    ) THEN
        RAISE EXCEPTION 'Não é possível excluir este documento pois ele está vinculado a uma análise de crédito já finalizada ou em andamento.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;