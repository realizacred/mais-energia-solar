-- Function to check for dependencies before deletion
CREATE OR REPLACE FUNCTION public.check_deletion_safety()
RETURNS TRIGGER AS $$
DECLARE
    has_finance RECORD;
    has_obras RECORD;
    has_proposals RECORD;
BEGIN
    -- If it's a project
    IF TG_TABLE_NAME = 'projetos' THEN
        -- Check finance
        SELECT 1 INTO has_finance FROM lancamentos_financeiros WHERE projeto_id = OLD.id LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'Projeto possui movimentações financeiras e não pode ser excluído.';
        END IF;

        -- Check obras
        SELECT 1 INTO has_obras FROM obras WHERE projeto_id = OLD.id LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'Projeto possui obras iniciadas e não pode ser excluído.';
        END IF;
    END IF;

    -- If it's a deal
    IF TG_TABLE_NAME = 'deals' THEN
        -- Deals usually don't have direct financial movements, but they have projects
        SELECT 1 INTO has_proposals FROM projetos WHERE deal_id = OLD.id LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'Negócio possui projeto vinculado e não pode ser excluído.';
        END IF;
    END IF;

    -- If it's an orcamento
    IF TG_TABLE_NAME = 'orcamentos' THEN
        -- Check if it's used in a project
        SELECT 1 INTO has_proposals FROM projetos WHERE orcamento_id = OLD.id LIMIT 1;
        IF FOUND THEN
            RAISE EXCEPTION 'Este orçamento está vinculado a um projeto ativo e não pode ser excluído.';
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS ensure_projeto_safety ON public.projetos;
CREATE TRIGGER ensure_projeto_safety
BEFORE DELETE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.check_deletion_safety();

DROP TRIGGER IF EXISTS ensure_deal_safety ON public.deals;
CREATE TRIGGER ensure_deal_safety
BEFORE DELETE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.check_deletion_safety();

DROP TRIGGER IF EXISTS ensure_orcamento_safety ON public.orcamentos;
CREATE TRIGGER ensure_orcamento_safety
BEFORE DELETE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.check_deletion_safety();
