
-- 1. ENUM
DO $$ BEGIN
  CREATE TYPE public.papel_funil AS ENUM (
    'comercial','engenharia','suprimentos','instalacao','concessionaria','pos_venda','outro'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. unaccent
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS unaccent; EXCEPTION WHEN OTHERS THEN null; END $$;

-- 3. Colunas papel
ALTER TABLE public.projeto_funis ADD COLUMN IF NOT EXISTS papel public.papel_funil NOT NULL DEFAULT 'outro';
ALTER TABLE public.pipelines     ADD COLUMN IF NOT EXISTS papel public.papel_funil NOT NULL DEFAULT 'outro';

-- 4. Função de sugestão
CREATE OR REPLACE FUNCTION public.suggest_papel_funil(p_nome text)
RETURNS public.papel_funil LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE n text;
BEGIN
  n := lower(public.unaccent(coalesce(p_nome, '')));
  IF n ~ '(comerc|vend|lead|negoc|propost)'                          THEN RETURN 'comercial';
  ELSIF n ~ '(engen|projet|tecnic|cad)'                              THEN RETURN 'engenharia';
  ELSIF n ~ '(supri|equipa|materia|compra|estoq)'                    THEN RETURN 'suprimentos';
  ELSIF n ~ '(instal|obra|execu|montag)'                             THEN RETURN 'instalacao';
  ELSIF n ~ '(concess|homolog|distribui|aneel|compesa|compensa)'     THEN RETURN 'concessionaria';
  ELSIF n ~ '(pos.?venda|posvenda|monitor|manute|garantia)'          THEN RETURN 'pos_venda';
  ELSE RETURN 'outro';
  END IF;
END $$;

-- 5. Auto-sugestão para registros existentes
UPDATE public.projeto_funis SET papel = public.suggest_papel_funil(nome) WHERE papel = 'outro';
UPDATE public.pipelines     SET papel = public.suggest_papel_funil(name) WHERE papel = 'outro';

-- 6. ai_funnel_rules
CREATE TABLE IF NOT EXISTS public.ai_funnel_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  funil_origem_papel public.papel_funil NOT NULL,
  etapa_origem_categoria public.projeto_etapa_categoria NOT NULL DEFAULT 'aberto',
  funil_alvo_papel public.papel_funil NOT NULL,
  etapa_alvo_categoria_esperada public.projeto_etapa_categoria NOT NULL,
  acao text NOT NULL DEFAULT 'alertar' CHECK (acao IN ('alertar','sugerir','auto_corrigir')),
  ativo boolean NOT NULL DEFAULT true,
  prioridade integer NOT NULL DEFAULT 100,
  template_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_ai_funnel_rules_tenant ON public.ai_funnel_rules(tenant_id, ativo);
ALTER TABLE public.ai_funnel_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rules_select_tenant" ON public.ai_funnel_rules;
CREATE POLICY "rules_select_tenant" ON public.ai_funnel_rules
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "rules_manage_admin" ON public.ai_funnel_rules;
CREATE POLICY "rules_manage_admin" ON public.ai_funnel_rules
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)))
  WITH CHECK (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)));

-- 7. ai_funnel_alerts
CREATE TABLE IF NOT EXISTS public.ai_funnel_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.ai_funnel_rules(id) ON DELETE SET NULL,
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  funil_origem_papel public.papel_funil NOT NULL,
  funil_alvo_papel public.papel_funil NOT NULL,
  etapa_atual_alvo text,
  etapa_esperada_alvo text,
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta')),
  estado text NOT NULL DEFAULT 'aberto' CHECK (estado IN ('aberto','corrigido','ignorado')),
  mensagem text,
  sugestao_ia text,
  detectado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_funnel_alerts_tenant_estado ON public.ai_funnel_alerts(tenant_id, estado, detectado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ai_funnel_alerts_projeto ON public.ai_funnel_alerts(projeto_id) WHERE projeto_id IS NOT NULL;
ALTER TABLE public.ai_funnel_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts_select_tenant" ON public.ai_funnel_alerts;
CREATE POLICY "alerts_select_tenant" ON public.ai_funnel_alerts
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "alerts_manage_admin" ON public.ai_funnel_alerts;
CREATE POLICY "alerts_manage_admin" ON public.ai_funnel_alerts
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)))
  WITH CHECK (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)));

-- 8. ai_features_config
CREATE TABLE IF NOT EXISTS public.ai_features_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_label text NOT NULL,
  feature_description text,
  enabled boolean NOT NULL DEFAULT true,
  provider text,
  model text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (tenant_id, feature_key)
);
ALTER TABLE public.ai_features_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_features_select_tenant" ON public.ai_features_config;
CREATE POLICY "ai_features_select_tenant" ON public.ai_features_config
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "ai_features_manage_admin" ON public.ai_features_config;
CREATE POLICY "ai_features_manage_admin" ON public.ai_features_config
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)))
  WITH CHECK (tenant_id = public.current_tenant_id()
         AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'gerente'::app_role)));

-- 9. Triggers updated_at
DROP TRIGGER IF EXISTS trg_ai_funnel_rules_updated ON public.ai_funnel_rules;
CREATE TRIGGER trg_ai_funnel_rules_updated BEFORE UPDATE ON public.ai_funnel_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ai_features_config_updated ON public.ai_features_config;
CREATE TRIGGER trg_ai_features_config_updated BEFORE UPDATE ON public.ai_features_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Seed features de IA
INSERT INTO public.ai_features_config (tenant_id, feature_key, feature_label, feature_description, enabled)
SELECT t.id, f.feature_key, f.feature_label, f.feature_description, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('funnel_coherence','Coerência de Funis','Detecta incoerências entre funis (ex: Engenharia avançou mas Comercial não fechou) e sugere correções.'),
  ('followup','Follow-up de Leads','Sugere mensagens de follow-up para leads frios.'),
  ('proposal_summary','Resumo de Proposta','Gera resumo executivo das propostas.'),
  ('whatsapp_assistant','Assistente WhatsApp','Sugestões de resposta nas conversas do WhatsApp.')
) AS f(feature_key, feature_label, feature_description)
ON CONFLICT (tenant_id, feature_key) DO NOTHING;
