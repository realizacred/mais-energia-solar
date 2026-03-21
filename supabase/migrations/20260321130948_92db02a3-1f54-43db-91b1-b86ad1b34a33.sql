
-- =====================================================
-- FEATURE FLAGS CATALOG + TENANT OVERRIDES + AUDIT LOG
-- Extends existing billing system (plans, plan_features, subscriptions)
-- =====================================================

-- 1. Feature flags catalog — central registry of all features
CREATE TABLE IF NOT EXISTS public.feature_flags_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags_catalog ENABLE ROW LEVEL SECURITY;

-- Readable by authenticated, managed by super_admin
CREATE POLICY "feature_catalog_select" ON public.feature_flags_catalog
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "feature_catalog_manage" ON public.feature_flags_catalog
  FOR ALL TO authenticated USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_feature_flags_catalog_updated_at
  BEFORE UPDATE ON public.feature_flags_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tenant feature overrides — per-tenant enable/disable
CREATE TABLE IF NOT EXISTS public.tenant_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.feature_flags_catalog(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_id)
);

ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_overrides_select" ON public.tenant_feature_overrides
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR is_super_admin(auth.uid()));

CREATE POLICY "tenant_overrides_manage" ON public.tenant_feature_overrides
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE TRIGGER update_tenant_feature_overrides_updated_at
  BEFORE UPDATE ON public.tenant_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Audit log for feature access
CREATE TABLE IF NOT EXISTS public.audit_feature_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  feature_key TEXT NOT NULL,
  access_result TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_feature_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_feature_select" ON public.audit_feature_access_log
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "audit_feature_insert" ON public.audit_feature_access_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Indices
CREATE INDEX IF NOT EXISTS idx_feature_flags_catalog_feature_key ON public.feature_flags_catalog(feature_key);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_tenant_id ON public.tenant_feature_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_feature_access_log_tenant_id ON public.audit_feature_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_feature_access_log_feature_key ON public.audit_feature_access_log(feature_key);

-- 4. Seed feature catalog with all features (including existing ones from plan_features)
INSERT INTO public.feature_flags_catalog (feature_key, name, description, category) VALUES
  ('advanced_reports', 'Relatórios Avançados', 'Relatórios PDF detalhados e exportações avançadas', 'Relatórios'),
  ('ai_followup', 'AI Follow-up', 'Follow-up automático inteligente via WhatsApp', 'IA'),
  ('ai_insights', 'AI Insights', 'Insights e análises geradas por inteligência artificial', 'IA'),
  ('api_access', 'Acesso API', 'Acesso à API para integrações externas', 'Integrações'),
  ('gamification', 'Gamificação', 'Sistema de metas e ranking de consultores', 'Equipe'),
  ('multi_instance_wa', 'Multi-instância WhatsApp', 'Múltiplas instâncias de WhatsApp simultâneas', 'Atendimento'),
  ('solar_market', 'Solar Market', 'Marketplace de equipamentos solares', 'Energia'),
  ('whatsapp_automation', 'Automações WhatsApp', 'Regras de automação e chatbot no WhatsApp', 'Atendimento'),
  ('white_label', 'White Label', 'Personalização completa da marca e domínio', 'Configurações'),
  ('monitoramento_basico', 'Monitoramento Básico', 'Monitoramento de usinas e geração de energia', 'Energia'),
  ('alerta_usina_offline', 'Alerta Usina Offline', 'Notificações quando usina fica offline', 'Energia'),
  ('alerta_performance', 'Alerta de Performance', 'Alertas de queda de performance da usina', 'Energia'),
  ('whatsapp_alertas', 'Alertas WhatsApp', 'Envio de alertas de monitoramento via WhatsApp', 'Atendimento'),
  ('relatorio_mensal_pdf', 'Relatório Mensal PDF', 'Geração automática de relatório mensal em PDF', 'Relatórios'),
  ('automacoes', 'Automações', 'Regras de automação e workflows avançados', 'Operações'),
  ('comparativo_uc', 'Comparativo UC', 'Comparação estimado vs real de geração por UC', 'Energia'),
  ('dashboards_avancados', 'Dashboards Avançados', 'Painéis analíticos avançados com múltiplos KPIs', 'Relatórios'),
  ('checklist_instalacao', 'Checklist Instalação', 'Checklists de instalação e vistoria técnica', 'Operações'),
  ('visitas_tecnicas', 'Visitas Técnicas', 'Agendamento e gestão de visitas técnicas', 'Operações'),
  ('faturas_energia', 'Faturas de Energia', 'Gestão e importação de faturas de energia', 'Energia'),
  ('nfse_fiscal', 'NFS-e Fiscal', 'Emissão e gestão de notas fiscais de serviço', 'Financeiro'),
  ('exportacao_relatorios', 'Exportação de Relatórios', 'Exportação de dados em CSV, Excel e PDF', 'Relatórios'),
  ('onboarding_guiado', 'Onboarding Guiado', 'Tour guiado e tutoriais interativos', 'Configurações')
ON CONFLICT (feature_key) DO NOTHING;

-- 5. Add new feature keys to plan_features for existing plans
-- Basic features for free plan
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, f.feature_key, 
  CASE WHEN f.feature_key IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas', 'faturas_energia') THEN true ELSE false END
FROM plans p
CROSS JOIN (VALUES 
  ('monitoramento_basico'), ('alerta_usina_offline'), ('alerta_performance'),
  ('whatsapp_alertas'), ('relatorio_mensal_pdf'), ('automacoes'),
  ('comparativo_uc'), ('dashboards_avancados'), ('checklist_instalacao'),
  ('visitas_tecnicas'), ('faturas_energia'), ('nfse_fiscal'),
  ('exportacao_relatorios'), ('onboarding_guiado')
) AS f(feature_key)
WHERE p.code = 'free'
ON CONFLICT DO NOTHING;

-- Starter plan
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, f.feature_key,
  CASE WHEN f.feature_key IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas', 
    'alerta_usina_offline', 'whatsapp_alertas', 'comparativo_uc', 'exportacao_relatorios', 'faturas_energia') 
  THEN true ELSE false END
FROM plans p
CROSS JOIN (VALUES 
  ('monitoramento_basico'), ('alerta_usina_offline'), ('alerta_performance'),
  ('whatsapp_alertas'), ('relatorio_mensal_pdf'), ('automacoes'),
  ('comparativo_uc'), ('dashboards_avancados'), ('checklist_instalacao'),
  ('visitas_tecnicas'), ('faturas_energia'), ('nfse_fiscal'),
  ('exportacao_relatorios'), ('onboarding_guiado')
) AS f(feature_key)
WHERE p.code = 'starter'
ON CONFLICT DO NOTHING;

-- Pro plan
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, f.feature_key,
  CASE WHEN f.feature_key IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas',
    'alerta_usina_offline', 'whatsapp_alertas', 'comparativo_uc', 'exportacao_relatorios', 'faturas_energia',
    'alerta_performance', 'relatorio_mensal_pdf', 'dashboards_avancados', 'nfse_fiscal')
  THEN true ELSE false END
FROM plans p
CROSS JOIN (VALUES 
  ('monitoramento_basico'), ('alerta_usina_offline'), ('alerta_performance'),
  ('whatsapp_alertas'), ('relatorio_mensal_pdf'), ('automacoes'),
  ('comparativo_uc'), ('dashboards_avancados'), ('checklist_instalacao'),
  ('visitas_tecnicas'), ('faturas_energia'), ('nfse_fiscal'),
  ('exportacao_relatorios'), ('onboarding_guiado')
) AS f(feature_key)
WHERE p.code = 'pro'
ON CONFLICT DO NOTHING;

-- Enterprise plan (all enabled)
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, f.feature_key, true
FROM plans p
CROSS JOIN (VALUES 
  ('monitoramento_basico'), ('alerta_usina_offline'), ('alerta_performance'),
  ('whatsapp_alertas'), ('relatorio_mensal_pdf'), ('automacoes'),
  ('comparativo_uc'), ('dashboards_avancados'), ('checklist_instalacao'),
  ('visitas_tecnicas'), ('faturas_energia'), ('nfse_fiscal'),
  ('exportacao_relatorios'), ('onboarding_guiado')
) AS f(feature_key)
WHERE p.code = 'enterprise'
ON CONFLICT DO NOTHING;
