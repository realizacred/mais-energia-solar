
-- Tabela de permissões de funcionalidades por usuário
CREATE TABLE public.user_feature_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT require_tenant_id() REFERENCES tenants(id),
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id, feature)
);

-- RLS
ALTER TABLE public.user_feature_permissions ENABLE ROW LEVEL SECURITY;

-- Admin pode tudo
CREATE POLICY "rls_ufp_all_admin"
ON public.user_feature_permissions
FOR ALL
USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Usuário pode ler suas próprias permissões
CREATE POLICY "rls_ufp_select_own"
ON public.user_feature_permissions
FOR SELECT
USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER update_user_feature_permissions_updated_at
BEFORE UPDATE ON public.user_feature_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função SECURITY DEFINER para verificar permissão de feature
CREATE OR REPLACE FUNCTION public.has_feature_permission(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM user_feature_permissions
     WHERE user_id = _user_id AND feature = _feature
     LIMIT 1),
    false
  );
$$;
