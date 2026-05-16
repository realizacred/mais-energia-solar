-- 1. Adicionar colunas de controle de duplicidade
ALTER TABLE public.project_documents 
ADD COLUMN IF NOT EXISTS merged_into_document_id UUID REFERENCES public.project_documents(id),
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- 2. Procedure que aceita ID para facilitar chamadas manuais e triggers
CREATE OR REPLACE FUNCTION public.proc_pd_sync_from_custom_field(_value_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_row RECORD;
    v_files JSONB;
    v_file JSONB;
    v_field_type TEXT;
    v_field_title TEXT;
    v_projeto_id UUID;
BEGIN
    SELECT v.*, f.field_type, f.title 
    INTO v_row 
    FROM public.deal_custom_field_values v
    JOIN public.deal_custom_fields f ON v.field_id = f.id
    WHERE v.id = _value_id;

    IF NOT FOUND THEN RETURN; END IF;

    IF v_row.field_type != 'file' OR v_row.value_text IS NULL OR v_row.value_text = '' THEN
        RETURN;
    END IF;

    BEGIN
        v_files := v_row.value_text::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RETURN;
    END;

    IF jsonb_typeof(v_files) != 'array' THEN
        RETURN;
    END IF;

    SELECT id INTO v_projeto_id FROM public.projetos WHERE deal_id = v_row.deal_id LIMIT 1;

    FOR v_file IN SELECT * FROM jsonb_array_elements(v_files)
    LOOP
        INSERT INTO public.project_documents (
            tenant_id, projeto_id, deal_id, categoria, origem, bucket, storage_path, file_name, mime_type, size_bytes, source_table, source_id, metadata
        ) VALUES (
            v_row.tenant_id, v_projeto_id, v_row.deal_id, v_row.title, 'custom_field', 'project-documents', 
            v_file->>'storage_path', v_file->>'filename', v_file->>'mime', (v_file->>'size')::BIGINT,
            'deal_custom_field_values', v_row.id, 
            jsonb_build_object('field_id', v_row.field_id, 'field_title', v_row.title, 'is_custom_field', true)
        )
        ON CONFLICT (bucket, storage_path) DO UPDATE
        SET 
            projeto_id = COALESCE(public.project_documents.projeto_id, EXCLUDED.projeto_id),
            deal_id = COALESCE(public.project_documents.deal_id, EXCLUDED.deal_id),
            metadata = public.project_documents.metadata || EXCLUDED.metadata,
            updated_at = now(),
            is_deleted = false,
            deleted_at = NULL;
    END LOOP;
END;
$$;

-- 3. Função de gatilho
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_custom_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.proc_pd_sync_from_custom_field(NEW.id);
    RETURN NEW;
END;
$$;

-- 4. Aplicar gatilho
DROP TRIGGER IF EXISTS trg_pd_from_custom_fields ON public.deal_custom_field_values;
CREATE TRIGGER trg_pd_from_custom_fields
AFTER INSERT OR UPDATE ON public.deal_custom_field_values
FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_custom_fields();

-- 5. Backfill: Popula project_documents
SELECT public.proc_pd_sync_from_custom_field(v.id)
FROM public.deal_custom_field_values v
JOIN public.deal_custom_fields f ON v.field_id = f.id
WHERE f.field_type = 'file' AND v.value_text IS NOT NULL AND v.value_text != '';
