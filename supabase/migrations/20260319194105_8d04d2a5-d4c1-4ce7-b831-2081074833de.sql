
-- =========================================
-- integration_guides table
-- =========================================
CREATE TABLE public.integration_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  title text NOT NULL,
  portal_url text,
  portal_label text,
  warning text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider_id)
);

ALTER TABLE public.integration_guides ENABLE ROW LEVEL SECURITY;

-- Super admins: full CRUD
CREATE POLICY "ig_super_admin_all" ON public.integration_guides
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Tenant admins: read only (own tenant + global guides where tenant_id IS NULL)
CREATE POLICY "ig_tenant_read" ON public.integration_guides
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = public.current_tenant_id()
  );

-- Tenant admins: manage their own tenant guides
CREATE POLICY "ig_tenant_manage" ON public.integration_guides
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND tenant_id = public.current_tenant_id()
  );

CREATE INDEX idx_integration_guides_provider ON public.integration_guides(provider_id);
CREATE INDEX idx_integration_guides_tenant ON public.integration_guides(tenant_id);

-- Updated_at trigger
CREATE TRIGGER update_integration_guides_updated_at
  BEFORE UPDATE ON public.integration_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Storage bucket for guide images
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('integration-guides', 'integration-guides', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ig_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'integration-guides');

CREATE POLICY "ig_storage_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'integration-guides'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "ig_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'integration-guides'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "ig_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'integration-guides'
    AND public.is_admin(auth.uid())
  );

-- =========================================
-- Seed default guides (tenant_id = NULL = global)
-- =========================================
INSERT INTO public.integration_guides (tenant_id, provider_id, title, portal_url, portal_label, warning, steps) VALUES
(NULL, 'solis_cloud', 'Como obter sua API Key da Solis Cloud', 'https://soliscloud.com', 'Abrir Solis Cloud', NULL,
 '[{"text":"Entre em contato com a Solis pelo WhatsApp (19 9 9961 8000) e solicite a liberação da API"},{"text":"Acesse soliscloud.com → aba ''Serviços''"},{"text":"Clique em ''Gerenciamento de API'' → ''Ativar agora''"},{"text":"Aceite os termos e clique em ''Visualizar chave''"},{"text":"Confirme com seu e-mail e copie o Key ID e Key Secret"}]'::jsonb),

(NULL, 'deye_cloud', 'Como criar API no Deye Cloud', 'https://us1.deyecloud.com', 'Abrir Deye Cloud', NULL,
 '[{"text":"Acesse us1.deyecloud.com com sua conta de Integrador"},{"text":"Vá em ''Organização'' e copie o ''Nome da empresa'' — esse será o campo Grupo"},{"text":"Clique em ''Developer Portal'' → ''Sign In''"},{"text":"Selecione seu servidor (Brasil ou Internacional)"},{"text":"Vá em ''Application'' → ''Create Application''"},{"text":"Preencha os dados e clique em criar"},{"text":"Copie o AppId e AppSecret gerados"}]'::jsonb),

(NULL, 'solaredge', 'Como obter sua API Key da SolarEdge', 'https://monitoring.solaredge.com', 'Abrir SolarEdge', NULL,
 '[{"text":"Acesse monitoring.solaredge.com e faça login"},{"text":"Clique no seu nome no menu superior → ''Minha conta''"},{"text":"Vá em ''Dados da Empresa''"},{"text":"Role até ''Acesso à API'' e aceite os termos"},{"text":"Copie a API Key gerada e clique em ''Salvar''"}]'::jsonb),

(NULL, 'sungrow_isolarcloud', 'Como criar chaves API no Sungrow', 'https://developer-api.isolarcloud.com', 'Abrir Sungrow Developer', NULL,
 '[{"text":"Acesse developer-api.isolarcloud.com"},{"text":"Faça login com sua conta iSolarCloud"},{"text":"Vá em ''Applications'' → ''Create Application''"},{"text":"Preencha os dados e selecione ''Não usar OAuth2.0''"},{"text":"Aguarde o status ''Review Passed''"},{"text":"Acesse o ícone da aplicação e copie App Key e App Secret"}]'::jsonb),

(NULL, 'fox_ess', 'Como criar API Key no FoxESS Cloud', 'https://www.foxesscloud.com', 'Abrir FoxESS Cloud', NULL,
 '[{"text":"Acesse foxesscloud.com e faça login"},{"text":"Clique em ''User Profile'' no canto superior direito"},{"text":"Vá em ''API Management''"},{"text":"Clique em ''Generate Api Key''"},{"text":"Copie a API Key gerada e use seu email e senha do portal"}]'::jsonb),

(NULL, 'livoltek', 'Como criar token no Livoltek', 'https://www.livoltek-portal.com', 'Abrir Livoltek', 'Defina uma data de validade bem no futuro para evitar expiração do token',
 '[{"text":"Acesse o portal Livoltek e faça login"},{"text":"Vá em ''My Profile'' (canto superior direito)"},{"text":"Clique em ''Security ID'' → ''Add''"},{"text":"Preencha os dados e defina uma data de validade longa (ex: ano 2050)"},{"text":"Copie a API Key e App Secret gerados"}]'::jsonb),

(NULL, 'livoltek_cf', 'Como criar token no Livoltek', 'https://www.livoltek-portal.com', 'Abrir Livoltek', 'Defina uma data de validade bem no futuro para evitar expiração do token',
 '[{"text":"Acesse o portal Livoltek e faça login"},{"text":"Vá em ''My Profile'' (canto superior direito)"},{"text":"Clique em ''Security ID'' → ''Add''"},{"text":"Preencha os dados e defina uma data de validade longa (ex: ano 2050)"},{"text":"Copie a API Key e App Secret gerados"}]'::jsonb),

(NULL, 'growatt', 'Como criar conta Growatt OSS', 'https://oss.growatt.com', 'Abrir Growatt OSS', NULL,
 '[{"text":"Acesse oss.growatt.com"},{"text":"Clique em ''Registrar'' e selecione ''Instalador''"},{"text":"Preencha os dados da empresa e confirme o e-mail"},{"text":"Anote o Código de Acesso gerado — você vai precisar dele aqui"},{"text":"Use esse código e sua senha para configurar"}]'::jsonb),

(NULL, 'huawei_fusionsolar', 'Como criar usuário de API no FusionSolar', 'https://intl.fusionsolar.huawei.com', 'Abrir FusionSolar', 'Crie um usuário dedicado para API. Não use seu login principal',
 '[{"text":"Acesse intl.fusionsolar.huawei.com e faça login"},{"text":"Vá em Configurações → Gerenciamento de Usuários"},{"text":"Crie um novo usuário especificamente para API"},{"text":"Use esse usuário e senha aqui — não use seu usuário principal"},{"text":"Se o token expirar, basta reconectar com as mesmas credenciais"}]'::jsonb),

(NULL, 'hoymiles_s_miles', 'Como configurar Hoymiles S-Miles', 'https://s-miles.com', 'Abrir S-Miles', NULL,
 '[{"text":"Acesse s-miles.com e faça login com sua conta de instalador"},{"text":"Use o mesmo email e senha do portal S-Miles aqui"}]'::jsonb);
