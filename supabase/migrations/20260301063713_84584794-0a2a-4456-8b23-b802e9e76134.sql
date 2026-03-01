
-- Fix overly permissive RLS on billing_webhook_events: restrict to service role only
DROP POLICY IF EXISTS "Service role full access on billing_webhook_events" ON public.billing_webhook_events;

-- No policies = only service_role can access (RLS enabled but no policies for anon/authenticated)
-- This is the correct pattern for webhook-only tables
