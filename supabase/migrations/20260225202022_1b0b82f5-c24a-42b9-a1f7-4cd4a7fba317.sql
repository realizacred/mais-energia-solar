
-- Remove overly permissive service-role policies (service_role bypasses RLS natively)
DROP POLICY IF EXISTS "service_insert_facebook_leads" ON public.facebook_leads;
DROP POLICY IF EXISTS "service_select_facebook_leads" ON public.facebook_leads;
DROP POLICY IF EXISTS "service_insert_facebook_ad_metrics" ON public.facebook_ad_metrics;
DROP POLICY IF EXISTS "service_update_facebook_ad_metrics" ON public.facebook_ad_metrics;
