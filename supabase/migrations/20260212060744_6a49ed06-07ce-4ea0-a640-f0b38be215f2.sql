-- Replace overly permissive service role policy with role-based check
DROP POLICY IF EXISTS "Service role manages calendar events" ON public.google_calendar_events;

-- Only allow INSERT/UPDATE/DELETE through service_role (edge functions)
-- This uses a function that checks if the current role is service_role
CREATE POLICY "Service role inserts calendar events"
ON public.google_calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id OR current_setting('role') = 'service_role');

CREATE POLICY "Service role updates calendar events"
ON public.google_calendar_events FOR UPDATE
USING (auth.uid() = user_id OR current_setting('role') = 'service_role');

CREATE POLICY "Service role deletes calendar events"
ON public.google_calendar_events FOR DELETE
USING (auth.uid() = user_id OR current_setting('role') = 'service_role');