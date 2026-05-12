ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_origem_check;
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_origem_check
  CHECK (origem = ANY (ARRAY['manual'::text, 'generated'::text, 'custom_field'::text, 'checklist_cliente'::text, 'checklist_instalador'::text, 'checklist_doc'::text, 'post_sale'::text, 'legacy'::text, 'recibo'::text]));