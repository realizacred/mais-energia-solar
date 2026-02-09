
-- Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule rate limit cleanup every 15 minutes
SELECT cron.schedule(
  'cleanup-edge-rate-limits',
  '*/15 * * * *',
  $$SELECT public.cleanup_edge_rate_limits()$$
);
