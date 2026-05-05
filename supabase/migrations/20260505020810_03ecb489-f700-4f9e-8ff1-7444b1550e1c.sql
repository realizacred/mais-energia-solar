-- 1) Mesclar assets da linha antiga (b345269e) para a linha atual (02969d9d)
UPDATE public.brand_settings AS dst
SET
  logo_url        = COALESCE(dst.logo_url, src.logo_url),
  logo_white_url  = COALESCE(dst.logo_white_url, src.logo_white_url),
  logo_small_url  = COALESCE(dst.logo_small_url, src.logo_small_url),
  favicon_url     = COALESCE(dst.favicon_url, src.favicon_url),
  login_image_url = COALESCE(dst.login_image_url, src.login_image_url),
  updated_at      = now()
FROM public.brand_settings AS src
WHERE dst.id = '02969d9d-89f0-4255-bf0b-9979c007e9e9'
  AND src.id = 'b345269e-0049-42dd-b8ab-effee86a7870';

-- 2) Remover a linha duplicada
DELETE FROM public.brand_settings
WHERE id = 'b345269e-0049-42dd-b8ab-effee86a7870';

-- 3) Garantir unicidade por tenant para impedir nova duplicação
ALTER TABLE public.brand_settings
  ADD CONSTRAINT brand_settings_tenant_id_unique UNIQUE (tenant_id);