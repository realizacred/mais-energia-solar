
-- Drop existing function if any (to recreate with correct signature)
DROP FUNCTION IF EXISTS public.claim_wa_bg_jobs(integer);

-- Atomic claim using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_wa_bg_jobs(max_jobs integer DEFAULT 20)
RETURNS SETOF wa_bg_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE wa_bg_jobs
  SET status = 'processing',
      updated_at = now()
  WHERE id IN (
    SELECT id FROM wa_bg_jobs
    WHERE status IN ('pending', 'failed')
      AND attempts < 5
      AND (next_run_at IS NULL OR next_run_at <= now())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT max_jobs
  )
  RETURNING *;
END;
$$;

-- Revoke all access from anon/authenticated
REVOKE ALL ON FUNCTION public.claim_wa_bg_jobs(integer) FROM anon, authenticated;

-- RLS hardening: drop any permissive policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'wa_bg_jobs' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.wa_bg_jobs', pol.policyname);
  END LOOP;
END;
$$;

-- Ensure RLS is enabled
ALTER TABLE public.wa_bg_jobs ENABLE ROW LEVEL SECURITY;

-- Deny-all policies for anon and authenticated
CREATE POLICY "deny_all_anon" ON public.wa_bg_jobs
  FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "deny_all_authenticated" ON public.wa_bg_jobs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Index for efficient claim query
CREATE INDEX IF NOT EXISTS idx_wa_bg_jobs_claim
  ON public.wa_bg_jobs (created_at ASC)
  WHERE status IN ('pending', 'failed') AND attempts < 5;
