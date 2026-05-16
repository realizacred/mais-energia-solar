-- Protection trigger for project_documents linked to locked credit analysis
CREATE OR REPLACE FUNCTION public.check_document_used_in_locked_credit()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM public.analise_credito_documentos ad
        JOIN public.analise_credito ac ON ad.analise_credito_id = ac.id
        WHERE ad.project_document_id = OLD.id 
        AND ac.is_locked = true
    ) THEN
        RAISE EXCEPTION 'Não é possível excluir este documento pois ele está vinculado a uma análise de crédito já finalizada ou em andamento.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_docs_in_credit ON public.project_documents;
CREATE TRIGGER tr_protect_docs_in_credit
BEFORE UPDATE OF is_deleted ON public.project_documents
FOR EACH ROW
WHEN (NEW.is_deleted = true AND OLD.is_deleted = false)
EXECUTE FUNCTION public.check_document_used_in_locked_credit();
