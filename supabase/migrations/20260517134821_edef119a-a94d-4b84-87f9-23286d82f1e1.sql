-- 1. Identificar se migrar d1 geraria conflito com d2
-- Vamos deletar da d2 (já migrada) o que queremos sobrescrever com a d1 (legacy), 
-- ou simplesmente deletar da d1 o que já existe na d2.
DELETE FROM project_documents 
WHERE bucket = 'project-documents' 
AND storage_path IN (
    SELECT storage_path FROM project_documents WHERE bucket = 'projeto-documentos'
);

-- 2. Agora o UPDATE não deve falhar por conflito de Unique Constraint
UPDATE project_documents 
SET bucket = 'projeto-documentos' 
WHERE bucket = 'project-documents';
