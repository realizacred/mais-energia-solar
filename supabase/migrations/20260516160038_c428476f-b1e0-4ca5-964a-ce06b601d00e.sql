CREATE OR REPLACE FUNCTION public.log_project_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_timeline_events (
        tenant_id, project_id, event_type, title, description, metadata, created_by
    )
    VALUES (
        NEW.tenant_id, NEW.id, 'lead_created', 'Projeto Criado', 
        'O projeto foi iniciado a partir do lead.', 
        jsonb_build_object('codigo', NEW.codigo, 'potencia', NEW.potencia_kwp),
        NEW.created_by
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_project_creation
AFTER INSERT ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.log_project_creation();
