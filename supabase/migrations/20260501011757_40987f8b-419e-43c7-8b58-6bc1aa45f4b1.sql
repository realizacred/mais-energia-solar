
-- Enum de status da homologação
DO $$ BEGIN
  CREATE TYPE public.homologacao_status AS ENUM (
    'nao_solicitada','solicitada','em_analise','aprovada','reprovada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.projeto_homologacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  status public.homologacao_status NOT NULL DEFAULT 'nao_solicitada',
  protocolo text,
  data_solicitacao date,
  data_aprovacao date,
  motivo_reprovacao text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_homologacao_projeto
  ON public.projeto_homologacao(projeto_id);

ALTER TABLE public.projeto_homologacao ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para resolver tenant do projeto
CREATE OR REPLACE FUNCTION public.tenant_of_projeto(_projeto_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.projetos WHERE id = _projeto_id $$;

DROP POLICY IF EXISTS "homolog_select" ON public.projeto_homologacao;
CREATE POLICY "homolog_select" ON public.projeto_homologacao
  FOR SELECT TO authenticated
  USING (public.tenant_of_projeto(projeto_id) = ((auth.jwt() ->> 'tenant_id'))::uuid);

DROP POLICY IF EXISTS "homolog_insert" ON public.projeto_homologacao;
CREATE POLICY "homolog_insert" ON public.projeto_homologacao
  FOR INSERT TO authenticated
  WITH CHECK (public.tenant_of_projeto(projeto_id) = ((auth.jwt() ->> 'tenant_id'))::uuid);

DROP POLICY IF EXISTS "homolog_update" ON public.projeto_homologacao;
CREATE POLICY "homolog_update" ON public.projeto_homologacao
  FOR UPDATE TO authenticated
  USING (public.tenant_of_projeto(projeto_id) = ((auth.jwt() ->> 'tenant_id'))::uuid)
  WITH CHECK (public.tenant_of_projeto(projeto_id) = ((auth.jwt() ->> 'tenant_id'))::uuid);

DROP POLICY IF EXISTS "homolog_delete" ON public.projeto_homologacao;
CREATE POLICY "homolog_delete" ON public.projeto_homologacao
  FOR DELETE TO authenticated
  USING (public.tenant_of_projeto(projeto_id) = ((auth.jwt() ->> 'tenant_id'))::uuid);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_projeto_homologacao_updated ON public.projeto_homologacao;
CREATE TRIGGER trg_projeto_homologacao_updated
  BEFORE UPDATE ON public.projeto_homologacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
