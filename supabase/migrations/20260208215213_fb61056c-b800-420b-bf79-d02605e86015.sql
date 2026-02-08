-- Clear the wrong api_token value (it was set to a URL instead of the actual token)
UPDATE public.solar_market_config 
SET api_token = NULL 
WHERE api_token LIKE 'http%';