UPDATE public.integrations_api_configs
SET is_active = true,
    status = 'active',
    updated_at = now()
WHERE provider IN ('jng', 'vertys');