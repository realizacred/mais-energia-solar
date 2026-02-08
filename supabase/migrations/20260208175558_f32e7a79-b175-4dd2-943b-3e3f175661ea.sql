
-- MULTI-TENANT INFRASTRUCTURE

-- 1. Tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE NOT NULL,
  dominio_customizado text,
  subdominio text UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  plano text NOT NULL DEFAULT 'starter',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
INSERT INTO public.tenants (id, nome, slug, subdominio)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mais Energia Solar', 'mais-energia-solar', 'maisenergiasolar');

-- 2. Add tenant_id to profiles FIRST
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- 3. Helper functions
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM profiles WHERE user_id = _user_id LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role::text = 'super_admin'
  )
$$;

-- 4. Site settings
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  nome_empresa text NOT NULL DEFAULT 'Mais Energia Solar',
  telefone text DEFAULT '(32) 99843-7675',
  whatsapp text DEFAULT '5532998437675',
  email text DEFAULT 'contato@maisenergiasolar.com.br',
  endereco_completo text DEFAULT 'Cataguases - MG',
  rua text, bairro text,
  cidade text DEFAULT 'Cataguases',
  estado text DEFAULT 'MG',
  cep text, google_maps_url text,
  coordenadas_lat numeric, coordenadas_lng numeric,
  horario_atendimento text DEFAULT 'Segunda a Sexta, 8h às 18h',
  texto_sobre text DEFAULT 'A Mais Energia Solar foi fundada em 2009, atuando inicialmente no ramo de reparos em eletrônicos. A partir de 2019, acompanhando as tendências do mercado, passamos a nos especializar em Energia Solar Fotovoltaica, Projetos Elétricos e Soluções Sustentáveis. Hoje, somos referência no desenvolvimento e instalação de sistemas de energia solar e também em bombas solares para irrigação, oferecendo soluções inovadoras para propriedades residenciais, comerciais, industriais e rurais.',
  texto_sobre_resumido text DEFAULT 'Energia solar para todos',
  slogan text DEFAULT 'Energia solar para todos',
  instagram_url text DEFAULT 'https://www.instagram.com/maismaisenergiasolaroficial/',
  facebook_url text, linkedin_url text, youtube_url text, tiktok_url text, site_url text,
  meta_title text DEFAULT 'Mais Energia Solar - Energia Solar Fotovoltaica',
  meta_description text DEFAULT 'Soluções completas em energia solar fotovoltaica. Economia de até 95% na conta de luz.',
  hero_titulo text DEFAULT 'O futuro da energia é agora!',
  hero_subtitulo text DEFAULT 'Soluções em energia solar fotovoltaica para residências, comércios, indústrias e propriedades rurais. Projetos personalizados com a melhor tecnologia.',
  hero_badge_texto text DEFAULT 'Economia de até 90% na conta de luz',
  hero_cta_texto text DEFAULT 'Solicitar Orçamento Grátis',
  hero_cta_whatsapp_texto text DEFAULT 'Fale no WhatsApp',
  cta_titulo text DEFAULT 'Deseja financiar seu sistema de energia solar?',
  cta_subtitulo text DEFAULT 'Envie suas informações que nossa equipe irá fazer uma cotação com as instituições financeiras parceiras e enviar a melhor proposta para você.',
  stat_anos_experiencia integer DEFAULT 15,
  stat_projetos_realizados integer DEFAULT 500,
  stat_economia_percentual integer DEFAULT 90,
  dominio_customizado text,
  instrucoes_dns text DEFAULT 'Configure um registro CNAME apontando para o endereço fornecido pela plataforma.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.site_settings (tenant_id) VALUES ('00000000-0000-0000-0000-000000000001');

-- 5. Site banners
CREATE TABLE public.site_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  imagem_url text NOT NULL, titulo text, subtitulo text,
  botao_texto text DEFAULT 'Solicitar Orçamento',
  botao_link text DEFAULT '#contato',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_banners ENABLE ROW LEVEL SECURITY;

-- 6. Add tenant_id to ALL remaining tables
DO $$
DECLARE
  tbl text;
  tables_list text[] := ARRAY[
    'brand_settings','user_roles','leads','orcamentos','clientes','vendedores','obras',
    'comissoes','lead_status','lead_atividades','concessionarias','disjuntores','transformadores',
    'calculadora_config','financiamento_bancos','financiamento_api_config',
    'gamification_config','instagram_config','instagram_posts',
    'checklist_templates','checklist_template_items',
    'checklists_instalacao','checklists_instalador','checklists_cliente',
    'checklist_cliente_arquivos','checklist_cliente_respostas',
    'checklist_instalador_arquivos','checklist_instalador_respostas',
    'instalador_config','instalador_metas','instalador_performance_mensal',
    'layouts_solares','meta_notifications',
    'projetos','recebimentos','simulacoes','servicos_agendados',
    'parcelas','pagamentos','pagamentos_comissao',
    'vendedor_achievements','vendedor_metas','vendedor_metricas','vendedor_performance_mensal',
    'webhook_config','whatsapp_automation_config','whatsapp_automation_logs',
    'whatsapp_automation_templates','whatsapp_messages','whatsapp_reminders',
    'release_checklists','audit_logs'
  ];
BEGIN
  FOR tbl IN SELECT unnest(tables_list) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='tenant_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT ''00000000-0000-0000-0000-000000000001''::uuid', tbl);
      END IF;
      EXECUTE format('UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000001''::uuid WHERE tenant_id IS NULL', tbl);
    END IF;
  END LOOP;
END $$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON public.clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_tenant ON public.orcamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_tenant ON public.vendedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obras_tenant ON public.obras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_banners_tenant ON public.site_banners(tenant_id, ordem);

-- 8. RLS
CREATE POLICY "Super admins manage tenants" ON public.tenants FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins read own tenant" ON public.tenants FOR SELECT USING (id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Public read active tenants" ON public.tenants FOR SELECT USING (ativo = true);

CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site_settings" ON public.site_settings FOR ALL USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Super admins manage all site_settings" ON public.site_settings FOR ALL USING (is_super_admin(auth.uid()));

CREATE POLICY "Public read active banners" ON public.site_banners FOR SELECT USING (ativo = true);
CREATE POLICY "Admins manage banners" ON public.site_banners FOR ALL USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Super admins manage all banners" ON public.site_banners FOR ALL USING (is_super_admin(auth.uid()));

-- 9. Triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_site_banners_updated_at BEFORE UPDATE ON public.site_banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_site_settings AFTER INSERT OR UPDATE OR DELETE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
CREATE TRIGGER audit_site_banners AFTER INSERT OR UPDATE OR DELETE ON public.site_banners FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
