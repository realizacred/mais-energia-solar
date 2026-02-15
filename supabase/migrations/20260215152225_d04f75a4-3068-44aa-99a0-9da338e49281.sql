
-- Fix: Drop the overly permissive "all" policy and replace with no public write access
-- Only service_role (bypasses RLS) should write to this table
DROP POLICY "Service role can manage followup logs" ON public.wa_followup_logs;
