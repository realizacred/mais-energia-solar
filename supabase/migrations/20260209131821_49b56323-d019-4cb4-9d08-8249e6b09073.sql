
-- Rate limiting table with automatic TTL cleanup
CREATE TABLE public.edge_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  identifier TEXT NOT NULL, -- IP, phone, instance_key, etc.
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  tenant_id UUID
);

-- Index for fast lookups
CREATE INDEX idx_edge_rate_limits_lookup 
ON public.edge_rate_limits (function_name, identifier, window_start);

-- Auto-cleanup old entries (older than 1 hour)
CREATE INDEX idx_edge_rate_limits_cleanup
ON public.edge_rate_limits (window_start);

-- RLS: only service_role should access this table
ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- Function to check and increment rate limit
-- Returns true if request is ALLOWED, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _function_name TEXT,
  _identifier TEXT,
  _window_seconds INTEGER DEFAULT 60,
  _max_requests INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_start TIMESTAMPTZ;
  _current_count INTEGER;
BEGIN
  _window_start := now() - (_window_seconds || ' seconds')::interval;

  -- Count requests in the current window
  SELECT COALESCE(SUM(request_count), 0) INTO _current_count
  FROM edge_rate_limits
  WHERE function_name = _function_name
    AND identifier = _identifier
    AND window_start >= _window_start;

  -- If over limit, deny
  IF _current_count >= _max_requests THEN
    RETURN FALSE;
  END IF;

  -- Insert new request record
  INSERT INTO edge_rate_limits (function_name, identifier, window_start)
  VALUES (_function_name, _identifier, now());

  RETURN TRUE;
END;
$$;

-- Cleanup function for old rate limit entries (call via cron)
CREATE OR REPLACE FUNCTION public.cleanup_edge_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM edge_rate_limits
  WHERE window_start < now() - interval '1 hour';
END;
$$;
