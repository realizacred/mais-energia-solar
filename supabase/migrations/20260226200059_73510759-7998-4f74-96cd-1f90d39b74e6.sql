
-- Fix: restrict "Service role manages" policies to only service_role (not anon)
-- These are used by Edge Functions only

DROP POLICY "Service role manages SM clients" ON public.solar_market_clients;
CREATE POLICY "Edge fn manages SM clients" ON public.solar_market_clients
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY "Service role manages SM projects" ON public.solar_market_projects;
CREATE POLICY "Edge fn manages SM projects" ON public.solar_market_projects
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY "Service role manages SM proposals" ON public.solar_market_proposals;
CREATE POLICY "Edge fn manages SM proposals" ON public.solar_market_proposals
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY "Service role manages SM sync logs" ON public.solar_market_sync_logs;
CREATE POLICY "Edge fn manages SM sync logs" ON public.solar_market_sync_logs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
