-- Adicionar coluna de nome exibição
ALTER TABLE public.project_documents 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Garantir que a tabela de eventos suporte os novos tipos de log se necessário
-- (A tabela já existe conforme verificado no esquema inicial)

COMMENT ON COLUMN public.project_documents.display_name IS 'Nome amigável para exibição no Hub de Documentos, preservando o nome original no storage.';

-- Adicionar índice para performance se necessário
CREATE INDEX IF NOT EXISTS idx_project_documents_display_name ON public.project_documents(display_name);
