ALTER TABLE public.document_templates DROP CONSTRAINT IF EXISTS document_templates_status_check;
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]));

-- Add 'recibo' as valid category (no CHECK existed, but enforce now to keep types canonical)
ALTER TABLE public.document_templates DROP CONSTRAINT IF EXISTS document_templates_categoria_check;
ALTER TABLE public.document_templates ADD CONSTRAINT document_templates_categoria_check CHECK (categoria = ANY (ARRAY['contrato'::text, 'procuracao'::text, 'proposta'::text, 'termo'::text, 'recibo'::text]));