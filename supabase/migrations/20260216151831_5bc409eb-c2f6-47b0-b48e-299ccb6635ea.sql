-- Deactivate any invalid google_calendar_client_id entries
-- (e.g. emails saved by autofill, or values not ending with .apps.googleusercontent.com)
UPDATE public.integration_configs
SET is_active = false,
    updated_at = now()
WHERE service_key = 'google_calendar_client_id'
  AND api_key NOT LIKE '%.apps.googleusercontent.com';

-- Also deactivate any client_secret that looks like an email
UPDATE public.integration_configs
SET is_active = false,
    updated_at = now()
WHERE service_key = 'google_calendar_client_secret'
  AND api_key LIKE '%@%';