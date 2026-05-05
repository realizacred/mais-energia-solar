
CREATE OR REPLACE FUNCTION public.get_public_brand_settings()
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
    bs.tenant_id, bs.logo_url, bs.logo_small_url, bs.logo_white_url,
    bs.favicon_url, bs.color_primary, bs.color_secondary,
    ss.nome_empresa AS nome_fantasia
  FROM public.brand_settings bs
  LEFT JOIN public.site_settings ss ON ss.tenant_id = bs.tenant_id
  ORDER BY bs.created_at ASC NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_brand_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_brand_settings() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_site_settings()
RETURNS TABLE (
  tenant_id uuid, nome_empresa text, telefone text, whatsapp text, email text,
  endereco_completo text, rua text, bairro text, cidade text, estado text, cep text,
  google_maps_url text, coordenadas_lat numeric, coordenadas_lng numeric,
  horario_atendimento text, texto_sobre text, texto_sobre_resumido text, slogan text,
  instagram_url text, facebook_url text, linkedin_url text, youtube_url text, tiktok_url text,
  site_url text, meta_title text, meta_description text,
  hero_titulo text, hero_subtitulo text, hero_badge_texto text, hero_cta_texto text, hero_cta_whatsapp_texto text,
  cta_titulo text, cta_subtitulo text,
  stat_anos_experiencia integer, stat_projetos_realizados integer, stat_economia_percentual integer,
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
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_site_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_settings() TO anon, authenticated;
