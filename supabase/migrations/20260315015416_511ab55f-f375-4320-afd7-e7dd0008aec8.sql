UPDATE public.ai_provider_config
SET 
  active_provider = 'openai',
  active_model = 'gpt-4o-mini',
  updated_at = now()
WHERE active_model = 'gpt-4o';