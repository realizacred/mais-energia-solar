
-- ============================================================
-- ONDA 1 — brand_settings
-- ============================================================
DROP POLICY IF EXISTS rls_brand_settings_select_anon ON public.brand_settings;

CREATE OR REPLACE FUNCTION public.get_public_brand_settings(_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  logo_url text,
  logo_small_url text,
  logo_white_url text,
  favicon_url text,
  color_primary text,
  color_secondary text,
  nome_fantasia text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bs.tenant_id,
    bs.logo_url,
    bs.logo_small_url,
    bs.logo_white_url,
    bs.favicon_url,
    bs.color_primary,
    bs.color_secondary,
    COALESCE(ss.nome_empresa, NULL) AS nome_fantasia
  FROM public.brand_settings bs
  LEFT JOIN public.site_settings ss ON ss.tenant_id = bs.tenant_id
  WHERE bs.tenant_id = _tenant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_brand_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_brand_settings(uuid) TO anon, authenticated;

-- ============================================================
-- ONDA 1 — site_settings
-- ============================================================
DROP POLICY IF EXISTS rls_site_settings_select_anon ON public.site_settings;

CREATE OR REPLACE FUNCTION public.get_public_site_settings(_tenant_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  nome_empresa text,
  telefone text,
  whatsapp text,
  email text,
  endereco_completo text,
  rua text,
  bairro text,
  cidade text,
  estado text,
  cep text,
  google_maps_url text,
  coordenadas_lat numeric,
  coordenadas_lng numeric,
  horario_atendimento text,
  texto_sobre text,
  texto_sobre_resumido text,
  slogan text,
  instagram_url text,
  facebook_url text,
  linkedin_url text,
  youtube_url text,
  tiktok_url text,
  site_url text,
  meta_title text,
  meta_description text,
  hero_titulo text,
  hero_subtitulo text,
  hero_badge_texto text,
  hero_cta_texto text,
  hero_cta_whatsapp_texto text,
  cta_titulo text,
  cta_subtitulo text,
  stat_anos_experiencia integer,
  stat_projetos_realizados integer,
  stat_economia_percentual integer,
  whatsapp_mensagem_padrao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tenant_id, nome_empresa, telefone, whatsapp, email,
    endereco_completo, rua, bairro, cidade, estado, cep,
    google_maps_url, coordenadas_lat, coordenadas_lng,
    horario_atendimento, texto_sobre, texto_sobre_resumido, slogan,
    instagram_url, facebook_url, linkedin_url, youtube_url, tiktok_url,
    site_url, meta_title, meta_description,
    hero_titulo, hero_subtitulo, hero_badge_texto, hero_cta_texto, hero_cta_whatsapp_texto,
    cta_titulo, cta_subtitulo,
    stat_anos_experiencia, stat_projetos_realizados, stat_economia_percentual,
    whatsapp_mensagem_padrao
  FROM public.site_settings
  WHERE tenant_id = _tenant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_settings(uuid) TO anon, authenticated;

-- ============================================================
-- ONDA 1 — bucket wa-attachments (privado + tenant-scoped)
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'wa-attachments';

DROP POLICY IF EXISTS storage_wa_attach_select_public ON storage.objects;

CREATE POLICY storage_wa_attach_select_tenant
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'wa-attachments'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);
