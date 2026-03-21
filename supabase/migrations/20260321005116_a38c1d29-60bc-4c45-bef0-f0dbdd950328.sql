-- Schedule weekly purge job: Sundays at 3h UTC (00h BRT)
SELECT cron.schedule(
  'purge-old-payloads-weekly',
  '0 3 * * 0',
  'SELECT public.purge_old_payloads()'
);