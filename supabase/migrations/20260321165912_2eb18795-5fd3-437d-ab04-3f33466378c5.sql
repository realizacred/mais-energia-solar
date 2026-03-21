-- Rename free → basic, update price and description
UPDATE public.plans SET code = 'basic', name = 'Basic', description = 'Operação básica para entrada', price_monthly = 97, price_yearly = 970, sort_order = 0, updated_at = now() WHERE id = 'dddd041c-b9d3-4849-965a-fd77e6764834';

-- Deactivate starter plan (keep data for existing subscriptions)
UPDATE public.plans SET is_active = false, updated_at = now() WHERE id = '96f16a67-11bb-4ae2-8c7d-b787e4d71bc4';

-- Update pro plan prices and mark as popular
UPDATE public.plans SET price_monthly = 297, price_yearly = 2970, description = 'Para crescimento e automação', is_popular = true, sort_order = 1, updated_at = now() WHERE id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc';

-- Update enterprise plan prices
UPDATE public.plans SET price_monthly = 697, price_yearly = 6970, description = 'Escala com IA e automações completas', sort_order = 2, updated_at = now() WHERE id = 'a7a348ea-90c9-420a-a5c5-eb75b14c0522';

-- ─── UPDATE BASIC (ex-free) PLAN FEATURES ───
-- Basic: monitoramento_basico, checklist_instalacao, visitas_tecnicas enabled; rest disabled
UPDATE public.plan_features SET enabled = true WHERE plan_id = 'dddd041c-b9d3-4849-965a-fd77e6764834' AND feature_key IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas');
UPDATE public.plan_features SET enabled = false WHERE plan_id = 'dddd041c-b9d3-4849-965a-fd77e6764834' AND feature_key NOT IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas');

-- ─── UPDATE PRO PLAN FEATURES ───
-- Pro: basic + comparativo_uc, whatsapp_alertas, exportacao_relatorios, faturas_energia
UPDATE public.plan_features SET enabled = true WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND feature_key IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas', 'comparativo_uc', 'whatsapp_alertas', 'exportacao_relatorios', 'faturas_energia');
UPDATE public.plan_features SET enabled = false WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND feature_key NOT IN ('monitoramento_basico', 'checklist_instalacao', 'visitas_tecnicas', 'comparativo_uc', 'whatsapp_alertas', 'exportacao_relatorios', 'faturas_energia');

-- ─── UPDATE ENTERPRISE PLAN FEATURES ───
-- Enterprise: all features enabled
UPDATE public.plan_features SET enabled = true WHERE plan_id = 'a7a348ea-90c9-420a-a5c5-eb75b14c0522';

-- ─── UPDATE BASIC PLAN LIMITS ───
UPDATE public.plan_limits SET limit_value = 0 WHERE plan_id = 'dddd041c-b9d3-4849-965a-fd77e6764834' AND limit_key IN ('max_ai_insights_month', 'max_automations', 'max_reports_pdf_month', 'max_performance_alerts');

-- ─── UPDATE PRO PLAN LIMITS ───
UPDATE public.plan_limits SET limit_value = 100 WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND limit_key = 'max_ai_insights_month';
UPDATE public.plan_limits SET limit_value = 50 WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND limit_key = 'max_automations';
UPDATE public.plan_limits SET limit_value = 30 WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND limit_key = 'max_reports_pdf_month';
UPDATE public.plan_limits SET limit_value = 100 WHERE plan_id = '7fb2a995-6bf2-43a1-99bf-11cd23a7b6dc' AND limit_key = 'max_performance_alerts';

-- ─── UPDATE ENTERPRISE PLAN LIMITS ───
UPDATE public.plan_limits SET limit_value = 999999 WHERE plan_id = 'a7a348ea-90c9-420a-a5c5-eb75b14c0522' AND limit_key IN ('max_ai_insights_month', 'max_automations', 'max_reports_pdf_month', 'max_performance_alerts');