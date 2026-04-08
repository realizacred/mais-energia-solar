
-- =============================================
-- 1. projeto_vistoria
-- =============================================
CREATE TABLE public.projeto_vistoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'nao_solicitada',
  protocolo text,
  data_solicitacao date,
  data_agendada date,
  data_realizada date,
  resultado text,
  motivo_reprovacao text,
  observacoes text,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_vistoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_projeto_vistoria" ON public.projeto_vistoria
  FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_insert_projeto_vistoria" ON public.projeto_vistoria
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_update_projeto_vistoria" ON public.projeto_vistoria
  FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_delete_projeto_vistoria" ON public.projeto_vistoria
  FOR DELETE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE TRIGGER update_projeto_vistoria_updated_at
  BEFORE UPDATE ON public.projeto_vistoria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. projeto_medidor
-- =============================================
CREATE TABLE public.projeto_medidor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  numero_medidor_antigo text,
  numero_medidor_novo text,
  data_troca date,
  tipo text DEFAULT 'bidirecional',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_medidor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_projeto_medidor" ON public.projeto_medidor
  FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_insert_projeto_medidor" ON public.projeto_medidor
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_update_projeto_medidor" ON public.projeto_medidor
  FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_delete_projeto_medidor" ON public.projeto_medidor
  FOR DELETE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE TRIGGER update_projeto_medidor_updated_at
  BEFORE UPDATE ON public.projeto_medidor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. projeto_ativacao
-- =============================================
CREATE TABLE public.projeto_ativacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT ((auth.jwt() ->> 'tenant_id')::uuid),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  data_ativacao date,
  numero_uc text,
  confirmado_por text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_ativacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_projeto_ativacao" ON public.projeto_ativacao
  FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_insert_projeto_ativacao" ON public.projeto_ativacao
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_update_projeto_ativacao" ON public.projeto_ativacao
  FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY "tenant_delete_projeto_ativacao" ON public.projeto_ativacao
  FOR DELETE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

CREATE TRIGGER update_projeto_ativacao_updated_at
  BEFORE UPDATE ON public.projeto_ativacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
