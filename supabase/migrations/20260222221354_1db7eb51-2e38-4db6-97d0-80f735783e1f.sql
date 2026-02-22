
-- Habilitar RLS nas 3 tabelas que estavam sem (pré-existente, não causado pela migração anterior)
ALTER TABLE public.projeto_proposta_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_counters ENABLE ROW LEVEL SECURITY;

-- Policies para tenant_counters (dados internos por tenant)
CREATE POLICY "tenant_own_counters" ON public.tenant_counters
  FOR ALL USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));

-- Policies para smtp_settings (config por tenant)
CREATE POLICY "tenant_own_smtp" ON public.smtp_settings
  FOR ALL USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));

-- Policies para projeto_proposta_counters (contadores por tenant)
CREATE POLICY "tenant_own_counters" ON public.projeto_proposta_counters
  FOR ALL USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()));
