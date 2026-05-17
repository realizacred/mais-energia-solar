-- Update legacy bucket references in project_documents
UPDATE public.project_documents
SET bucket = 'projeto-documentos'
WHERE bucket = 'project-documents';
