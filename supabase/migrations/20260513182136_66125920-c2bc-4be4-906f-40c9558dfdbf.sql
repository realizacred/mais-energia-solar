-- Helper SECURITY DEFINER para validar token público sem cair em RLS de proposta_aceite_tokens
CREATE OR REPLACE FUNCTION public.is_valid_public_token_for_versao(p_versao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proposta_aceite_tokens t
    WHERE t.versao_id = p_versao_id
      AND t.expires_at > now()
      AND t.invalidado_em IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_public_token_for_versao(uuid) TO anon, authenticated;

-- Substituir política em proposta_versoes para usar helper SECURITY DEFINER
DROP POLICY IF EXISTS "Anon read versao via valid token" ON public.proposta_versoes;
CREATE POLICY "Anon read versao via valid token"
  ON public.proposta_versoes
  FOR SELECT
  TO anon
  USING (public.is_valid_public_token_for_versao(id));

-- Substituir política em proposta_templates
DROP POLICY IF EXISTS "Anon read template via valid token" ON public.proposta_templates;
CREATE POLICY "Anon read template via valid token"
  ON public.proposta_templates
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.proposta_versoes v
      WHERE v.template_id_used = proposta_templates.id
        AND public.is_valid_public_token_for_versao(v.id)
    )
  );

-- Adicionar políticas anon para renders e cenarios (não existiam)
DROP POLICY IF EXISTS "Anon read render via valid token" ON public.proposta_renders;
CREATE POLICY "Anon read render via valid token"
  ON public.proposta_renders
  FOR SELECT
  TO anon
  USING (public.is_valid_public_token_for_versao(versao_id));

DROP POLICY IF EXISTS "Anon read cenarios via valid token" ON public.proposta_cenarios;
CREATE POLICY "Anon read cenarios via valid token"
  ON public.proposta_cenarios
  FOR SELECT
  TO anon
  USING (public.is_valid_public_token_for_versao(versao_id));

-- Permitir anon baixar PDF do bucket proposta-documentos quando há token válido
DROP POLICY IF EXISTS "Anon read proposta-documentos via valid token" ON storage.objects;
CREATE POLICY "Anon read proposta-documentos via valid token"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (
    bucket_id = 'proposta-documentos'
    AND EXISTS (
      SELECT 1
      FROM public.proposta_versoes v
      WHERE v.output_pdf_path = storage.objects.name
        AND public.is_valid_public_token_for_versao(v.id)
    )
  );