
-- =============================================
-- TABELA: release_checklists (Histórico de validações de deploy)
-- =============================================
CREATE TABLE public.release_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao text NOT NULL DEFAULT '',
  commit_hash text,
  ambiente text NOT NULL DEFAULT 'staging',
  status text NOT NULL DEFAULT 'em_andamento',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  aprovado_por uuid,
  aprovado_em timestamptz,
  criado_por uuid NOT NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.release_checklists ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar
CREATE POLICY "Admins manage release_checklists"
  ON public.release_checklists
  FOR ALL
  USING (is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_release_checklists_updated_at
  BEFORE UPDATE ON public.release_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário
COMMENT ON TABLE public.release_checklists IS 'Histórico de validações de deploy com checklist obrigatório antes de ir para produção';
